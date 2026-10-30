import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_active_org
from app.models.organization import Organization
from app.models.import_job import ImportJob
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackResponse,
    PaginatedFeedbackResponse,
    SyntheticGenerationRequest,
    SyntheticGenerationResponse,
    CSVUploadResponse,
    ImportJobResponse,
)
from app.schemas.analysis import (
    FeedbackAnalysisResponse,
    BatchAnalysisRequest,
    BatchAnalysisResponse,
)
from app.services.feedback_service import FeedbackService
from app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/feedback", tags=["Feedback Ingestion & Intelligence"])


async def resolve_org_or_first(
    x_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    org_dep: Optional[Organization] = Depends(get_current_active_org),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Helper ensuring a valid active tenant context exists."""
    if org_dep:
        return org_dep
    # Fallback to the first active organization if available
    stmt = select(Organization).where(Organization.is_active.is_(True)).limit(1)
    res = await db.execute(stmt)
    org = res.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization exists. Please onboard a tenant first via /api/v1/organizations",
        )
    return org


@router.get("", response_model=PaginatedFeedbackResponse, summary="List Feedback Records")
async def list_feedback(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    meal_type: Optional[str] = None,
    item: Optional[str] = None,
    issue_category: Optional[str] = None,
    sentiment: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    channel: Optional[str] = None,
    food_safety_only: bool = False,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> PaginatedFeedbackResponse:
    """List paginated feedback records scoped to the tenant organization."""
    return await FeedbackService.list_feedback(
        db=db,
        organization_id=org.id,
        page=page,
        page_size=page_size,
        meal_type=meal_type,
        item=item,
        issue_category=issue_category,
        sentiment=sentiment,
        date_from=date_from,
        date_to=date_to,
        channel=channel,
        food_safety_only=food_safety_only,
    )


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED, summary="Submit Single Feedback")
async def create_single_feedback(
    payload: FeedbackCreate,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    """Submit a single feedback record scoped to the active tenant with immediate AI analysis."""
    fb = await FeedbackService.create_feedback(db, payload, organization_id=org.id)
    if fb.comment:
        try:
            await FeedbackService.analyze_feedback_item(db, fb)
        except Exception:
            pass

    refreshed = await FeedbackService.get_by_id(db, fb.id, org.id)
    if refreshed:
        fb = refreshed
    return FeedbackResponse.model_validate(fb)


@router.get("/{feedback_id}", response_model=FeedbackResponse, summary="Get Feedback Details")
async def get_feedback(
    feedback_id: uuid.UUID,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    fb = await FeedbackService.get_by_id(db, feedback_id, organization_id=org.id)
    if not fb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback record not found")
    return FeedbackResponse.model_validate(fb)


@router.post("/upload-csv", response_model=CSVUploadResponse, summary="Upload Feedback CSV")
async def upload_csv_feedback(
    file: UploadFile = File(...),
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> CSVUploadResponse:
    """
    Ingest bulk feedback from CSV.
    Supports standard canteen feedback schemas and Zomato Bangalore Kaggle dataset.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only CSV files are supported.",
        )

    content_bytes = await file.read()
    if len(content_bytes) > 25 * 1024 * 1024:  # 25 MB safety limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="CSV file exceeds maximum allowed size of 25MB",
        )

    try:
        csv_text = content_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to decode CSV text: {e}",
        )

    job = await IngestionService.process_csv_content(
        db=db,
        csv_text=csv_text,
        organization_id=org.id,
        filename=file.filename,
    )

    return CSVUploadResponse(
        import_job=ImportJobResponse.model_validate(job),
        message=f"CSV processed: {job.successful_records} imported, {job.duplicate_records} duplicates, {job.failed_records} failed.",
    )


@router.post("/generate-synthetic", response_model=SyntheticGenerationResponse, summary="Generate Synthetic Feedback")
async def generate_synthetic_feedback(
    payload: SyntheticGenerationRequest,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> SyntheticGenerationResponse:
    """Generate realistic synthetic student feedback with seeded recurring issue scenarios."""
    feedbacks = await FeedbackService.generate_synthetic_data(
        db=db,
        organization_id=org.id,
        count=payload.count,
        seed_recurring=payload.seed_recurring_issues,
    )

    seeded_scenarios = [
        "Cold Sambar at Lunch Station B",
        "Salt spike in Tuesday Dal Tadka",
        "Undercooked Chicken on Friday Lunch",
        "Sour / Curdled Paneer Spoilage Hazard",
    ] if payload.seed_recurring_issues else []

    return SyntheticGenerationResponse(
        generated_count=len(feedbacks),
        seeded_scenarios=seeded_scenarios,
        sample_records=[FeedbackResponse.model_validate(f) for f in feedbacks[:5]],
    )


@router.post("/{feedback_id}/analyze", response_model=FeedbackAnalysisResponse, summary="Execute AI Analysis on Feedback")
async def analyze_single_feedback(
    feedback_id: uuid.UUID,
    force_reanalyze: bool = Query(False, description="Whether to bypass cached analysis and re-run LLM"),
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> FeedbackAnalysisResponse:
    """Invokes the LangChain Feedback Analysis Agent to extract aspects, sentiment, and safety flags."""
    fb = await FeedbackService.get_by_id(db, feedback_id, organization_id=org.id)
    if not fb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback record not found")

    analysis = await FeedbackService.analyze_feedback_item(db, fb, force_reanalyze=force_reanalyze)
    return FeedbackAnalysisResponse.model_validate(analysis)


@router.post("/batch-analyze", response_model=BatchAnalysisResponse, summary="Execute Batch AI Analysis")
async def batch_analyze_feedback(
    payload: BatchAnalysisRequest,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> BatchAnalysisResponse:
    """Executes AI Analysis on multiple feedback records."""
    return await FeedbackService.batch_analyze(
        db=db,
        organization_id=org.id,
        feedback_ids=payload.feedback_ids,
        limit=payload.limit,
    )


@router.get("/import-jobs/{job_id}", response_model=ImportJobResponse, summary="Get Import Job Status")
async def get_import_job(
    job_id: uuid.UUID,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> ImportJobResponse:
    stmt = select(ImportJob).where(ImportJob.id == job_id, ImportJob.organization_id == org.id)
    res = await db.execute(stmt)
    job = res.scalars().first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")
    return ImportJobResponse.model_validate(job)
