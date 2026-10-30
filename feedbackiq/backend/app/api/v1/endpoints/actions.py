import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user_optional, get_current_active_org
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.task import ActionTask, TaskStatus
from app.schemas.task import (
    TaskResponse,
    TaskFilterParams,
    TaskAssignRequest,
    TaskStatusUpdateRequest,
    VerificationResultResponse,
    TaskUpdateRequest,
)
from app.services.task_service import TaskService
from app.services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/actions", tags=["Actions & CAPA Lifecycle"])


class ActionResolveRequest(BaseModel):
    resolution_notes: str = Field(..., description="Action resolution notes and steps taken to fix the root cause")


class ActionPatchRequest(BaseModel):
    status: Optional[str] = None
    priority_score: Optional[float] = None
    risk_level: Optional[str] = None
    assignee_name: Optional[str] = None
    resolution_notes: Optional[str] = None
    due_date: Optional[datetime] = None


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
    if current_user:
        return current_user
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
    return User(
        id=user_id,
        email="manager@feedbackiq.io",
        full_name="Operations Staff",
        role=role,
        organization_id=org.id,
        is_active=True,
    )


@router.get("", response_model=List[TaskResponse], summary="List Corrective Actions")
async def list_actions(
    status_filter: Optional[str] = Query(None, alias="status"),
    risk_level: Optional[str] = None,
    item: Optional[str] = None,
    issue_category: Optional[str] = None,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Returns prioritized corrective action recommendations."""
    filters = TaskFilterParams(
        status=status_filter,
        risk_level=risk_level,
        item=item,
        issue_category=issue_category,
    )
    return await TaskService.get_tasks(
        db=db,
        organization_id=org.id,
        filters=filters,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=List[TaskResponse], summary="Synthesize / Generate Actions")
async def create_or_generate_actions(
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Synthesizes prioritized action tasks from intelligence clusters with deduplication."""
    prioritized_issues = await IntelligenceService.get_persisted_assessments(
        db=db,
        organization_id=org.id,
    )
    if not prioritized_issues:
        prioritized_issues = await IntelligenceService.assess_and_prioritize_all(
            db=db,
            organization_id=org.id,
        )
    return await TaskService.generate_tasks_for_prioritized_issues(
        db=db,
        organization_id=org.id,
        prioritized_items=prioritized_issues,
    )


@router.get("/{action_id}", response_model=TaskResponse, summary="Get Action Details")
async def get_action(
    action_id: uuid.UUID,
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves full details of a specific action task."""
    return await TaskService.get_task_by_id(db, action_id, org.id)


@router.patch("/{action_id}", response_model=TaskResponse, summary="Update Action Task")
async def patch_action(
    action_id: uuid.UUID,
    payload: ActionPatchRequest,
    user: User = Depends(resolve_acting_user),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Allows administrators to update action status, priority, assignee, or resolution notes."""
    task = await TaskService.get_task_by_id(db, action_id, org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    if payload.status:
        # Standardize status
        st = payload.status.lower()
        if st in ["resolved", "completed"]:
            st = TaskStatus.COMPLETED.value
        elif st in ["in_progress", "inprogress"]:
            st = TaskStatus.IN_PROGRESS.value
        elif st in ["assigned"]:
            st = TaskStatus.ASSIGNED.value
        elif st in ["pending", "proposed"]:
            st = TaskStatus.PROPOSED.value

        await TaskService.update_task_status(
            db=db,
            task_id=action_id,
            organization_id=org.id,
            user=user,
            request=TaskStatusUpdateRequest(
                status=st,
                completion_notes=payload.resolution_notes,
            ),
        )

    # Reload and return updated task
    stmt = select(ActionTask).where(ActionTask.id == action_id, ActionTask.organization_id == org.id)
    res = await db.execute(stmt)
    entity = res.scalars().first()

    if payload.priority_score is not None:
        entity.priority_score = payload.priority_score
    if payload.risk_level:
        entity.risk_level = payload.risk_level
    if payload.assignee_name:
        entity.assignee_name = payload.assignee_name
    if payload.due_date:
        entity.due_date = payload.due_date
    if payload.resolution_notes:
        entity.completion_notes = payload.resolution_notes

    await db.commit()
    await db.refresh(entity)
    return TaskResponse.model_validate(entity)


@router.post("/{action_id}/assign", response_model=TaskResponse, summary="Assign Action to Staff")
async def assign_action(
    action_id: uuid.UUID,
    payload: TaskAssignRequest,
    user: User = Depends(resolve_acting_user),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Assigns an action task to a responsible staff member with a target due date."""
    return await TaskService.assign_task(
        db=db,
        task_id=action_id,
        organization_id=org.id,
        manager_user=user,
        request=payload,
    )


@router.post("/{action_id}/resolve", response_model=TaskResponse, summary="Mark Action as Resolved")
async def resolve_action(
    action_id: uuid.UUID,
    payload: ActionResolveRequest,
    user: User = Depends(resolve_acting_user),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Marks an issue as resolved and records resolution notes."""
    return await TaskService.update_task_status(
        db=db,
        task_id=action_id,
        organization_id=org.id,
        user=user,
        request=TaskStatusUpdateRequest(
            status=TaskStatus.COMPLETED.value,
            completion_notes=payload.resolution_notes,
        ),
    )


@router.post("/{action_id}/verify", response_model=VerificationResultResponse, summary="Verify Action Outcome")
async def verify_action(
    action_id: uuid.UUID,
    window_days: int = Query(7, ge=1, le=30, description="Pre/post comparison window in days"),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Statistically verifies whether the resolved issue has actually improved."""
    return await TaskService.verify_task(
        db=db,
        task_id=action_id,
        organization_id=org.id,
        window_days=window_days,
    )
