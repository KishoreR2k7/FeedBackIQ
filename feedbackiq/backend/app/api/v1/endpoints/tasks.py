import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user_optional, get_current_active_org
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.task import ActionTask
from app.schemas.task import (
    TaskResponse,
    TaskFilterParams,
    TaskApprovalRequest,
    TaskAssignRequest,
    TaskStatusUpdateRequest,
    VerificationResultResponse,
)
from app.services.task_service import TaskService
from app.services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/tasks", tags=["Prioritized Action Tasks & CAPA"])


async def resolve_org(
    x_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    org_dep: Optional[Organization] = Depends(get_current_active_org),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    if org_dep:
        return org_dep
    if x_org_id:
        try:
            target_id = uuid.UUID(x_org_id)
            stmt = select(Organization).where(Organization.id == target_id)
            res = await db.execute(stmt)
            org = res.scalars().first()
            if org:
                return org
        except Exception:
            pass

    stmt = select(Organization).where(Organization.is_active.is_(True)).limit(1)
    res = await db.execute(stmt)
    org = res.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization exists. Please onboard a tenant first.",
        )
    return org


async def resolve_acting_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(resolve_org),
) -> User:
    """
    Resolves the user making the request. Supports JWT tokens, with header fallback
    for role-based testing and API simulation.
    """
    if current_user:
        return current_user

    # Header-based role simulation (e.g. for API testing)
    role = UserRole.ORG_ADMIN
    if x_user_role:
        try:
            role = UserRole(x_user_role.lower())
        except ValueError:
            pass

    user_id = uuid.uuid4()
    if x_user_id:
        try:
            user_id = uuid.UUID(x_user_id)
        except ValueError:
            pass

    # Return a simulated user object with the given role
    return User(
        id=user_id,
        email="operator@feedbackiq.io",
        full_name="Operations Staff",
        role=role,
        organization_id=org.id,
        is_active=True,
    )


@router.get("", response_model=List[TaskResponse], summary="List Prioritized Action Tasks")
async def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    approval_status: Optional[str] = None,
    risk_level: Optional[str] = None,
    responsible_role: Optional[str] = None,
    assignee_id: Optional[uuid.UUID] = None,
    item: Optional[str] = None,
    issue_category: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns prioritized action tasks for the active tenant with multi-dimensional filtering.
    """
    filters = TaskFilterParams(
        status=status_filter,
        approval_status=approval_status,
        risk_level=risk_level,
        responsible_role=responsible_role,
        assignee_id=assignee_id,
        item=item,
        issue_category=issue_category,
        date_from=date_from,
        date_to=date_to,
    )
    tasks = await TaskService.get_tasks(
        db=db,
        organization_id=org.id,
        filters=filters,
        limit=limit,
        offset=offset,
    )
    return tasks


@router.post("/generate", response_model=List[TaskResponse], summary="Synthesize CAPA Tasks from Intelligence")
async def generate_tasks(
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluates current prioritized clusters and generates deduplicated CAPA action tasks.
    """
    prioritized_issues = await IntelligenceService.get_persisted_assessments(
        db=db,
        organization_id=org.id,
    )
    if not prioritized_issues:
        # If no persisted assessments exist yet, run assessment
        prioritized_issues = await IntelligenceService.assess_and_prioritize_all(
            db=db,
            organization_id=org.id,
        )

    tasks = await TaskService.generate_tasks_for_prioritized_issues(
        db=db,
        organization_id=org.id,
        prioritized_items=prioritized_issues,
    )
    return tasks


@router.get("/{task_id}", response_model=TaskResponse, summary="Get Action Task Details")
async def get_task(
    task_id: uuid.UUID,
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full details of a specific action task."""
    return await TaskService.get_task_by_id(db, task_id, org.id)


@router.post("/{task_id}/approve", response_model=TaskResponse, summary="Manager Approval or Rejection")
async def approve_task(
    task_id: uuid.UUID,
    request: TaskApprovalRequest,
    user: User = Depends(resolve_acting_user),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Approves or rejects a proposed action plan. Requires manager authorization.
    """
    return await TaskService.approve_task(
        db=db,
        task_id=task_id,
        organization_id=org.id,
        user=user,
        request=request,
    )


@router.post("/{task_id}/assign", response_model=TaskResponse, summary="Assign Task to Staff")
async def assign_task(
    task_id: uuid.UUID,
    request: TaskAssignRequest,
    user: User = Depends(resolve_acting_user),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Assigns an action task to a responsible staff member with a due date.
    """
    return await TaskService.assign_task(
        db=db,
        task_id=task_id,
        organization_id=org.id,
        manager_user=user,
        request=request,
    )


@router.post("/{task_id}/status", response_model=TaskResponse, summary="Update Task Progress & Completion")
async def update_status(
    task_id: uuid.UUID,
    request: TaskStatusUpdateRequest,
    user: User = Depends(resolve_acting_user),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Advances task lifecycle (e.g. in_progress -> completed) with optional completion notes.
    """
    return await TaskService.update_task_status(
        db=db,
        task_id=task_id,
        organization_id=org.id,
        user=user,
        request=request,
    )


@router.post("/{task_id}/verify", response_model=VerificationResultResponse, summary="Run Before/After Outcome Verification")
async def verify_task(
    task_id: uuid.UUID,
    window_days: int = Query(7, ge=1, le=30, description="Pre/post comparison window in days"),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Statistically compares feedback metrics before and after task intervention.
    Returns Improved, No Clear Improvement, Worsened, or Insufficient Evidence.
    """
    return await TaskService.verify_task(
        db=db,
        task_id=task_id,
        organization_id=org.id,
        window_days=window_days,
    )
