import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

TaskApprovalStatusType = Literal["proposed", "awaiting_approval", "approved", "rejected"]
TaskStatusType = Literal[
    "proposed",
    "awaiting_approval",
    "assigned",
    "in_progress",
    "completed",
    "verified",
    "rejected",
]
VerificationOutcomeType = Literal[
    "Improved",
    "No Clear Improvement",
    "Worsened",
    "Insufficient Evidence",
    "Pending",
]
EstimatedEffortType = Literal["Low", "Medium", "High"]


class ActionRecommendationOutput(BaseModel):
    """
    Pydantic schema passed directly to LangChain .with_structured_output().
    Contract for evidence-based corrective and preventive action generation.
    """
    issue_summary: str = Field(
        ...,
        description="Factual, concise summary of the quality breakdown based strictly on feedback quotes.",
    )
    evidence_and_priority_reason: str = Field(
        ...,
        description="Specific empirical evidence, recurrence signals, and rationale explaining this issue's priority.",
    )
    suggested_corrective_action: str = Field(
        ...,
        description="Immediate practical containment action to resolve the active breakdown (e.g., immediate temperature recalibration).",
    )
    suggested_preventive_action: str = Field(
        ...,
        description="Structural or procedural change to prevent recurrence (e.g., bain-marie holding log checklists).",
    )
    responsible_role: str = Field(
        ...,
        description="Responsible kitchen or operational role (e.g. 'Head Chef', 'Hygiene Supervisor', 'Procurement Lead').",
    )
    suggested_deadline_days: int = Field(
        default=3,
        ge=1,
        le=30,
        description="Operational deadline window in days from task creation (1 for safety emergencies, 3-7 for operational adjustments).",
    )
    required_approval: str = Field(
        default="None / Immediate Execution",
        description="Governance level required: 'Operations Manager Approval', 'Food Safety Officer Approval', or 'None / Immediate Execution'.",
    )
    estimated_effort: EstimatedEffortType = Field(
        default="Medium",
        description="Estimated operational resource effort: Low, Medium, or High.",
    )
    verification_criteria: str = Field(
        ...,
        description="Measurable empirical criteria to verify that the corrective action successfully resolved the issue.",
    )
    expected_outcome: str = Field(
        ...,
        description="Expected qualitative and quantitative outcome (e.g., reduction in temperature complaints at lunch).",
    )


class TaskBase(BaseModel):
    issue_cluster_key: str
    item: Optional[str] = None
    issue_category: Optional[str] = None
    meal_type: Optional[str] = None
    priority_score: float
    risk_level: str
    is_safety_override: bool = False
    issue_summary: str
    evidence_and_priority_reason: str
    corrective_action: str
    preventive_action: str
    responsible_role: str
    required_approval: str = "None / Immediate Execution"
    estimated_effort: str = "Medium"
    verification_criteria: str = ""
    expected_outcome: str = ""


class TaskCreateRequest(TaskBase):
    assignee_id: Optional[uuid.UUID] = None
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskUpdateRequest(BaseModel):
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    responsible_role: Optional[str] = None
    priority_score: Optional[float] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[uuid.UUID] = None
    assignee_name: Optional[str] = None


class TaskApprovalRequest(BaseModel):
    approved: bool = Field(..., description="True to approve task, False to reject")
    rejection_reason: Optional[str] = Field(None, description="Explanation if rejected")
    modified_due_date: Optional[datetime] = None
    assignee_id: Optional[uuid.UUID] = None
    assignee_name: Optional[str] = None


class TaskAssignRequest(BaseModel):
    assignee_id: uuid.UUID
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    operational_notes: Optional[str] = None


class TaskStatusUpdateRequest(BaseModel):
    status: TaskStatusType
    completion_notes: Optional[str] = None


class VerificationResultResponse(BaseModel):
    task_id: uuid.UUID
    verification_status: VerificationOutcomeType
    pre_action_complaints: int
    post_action_complaints: int
    complaint_change_percent: Optional[float] = None
    pre_action_avg_rating: Optional[float] = None
    post_action_avg_rating: Optional[float] = None
    pre_window_days: int
    post_window_days: int
    non_causal_explanation: str


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    assignee_id: Optional[uuid.UUID] = None
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    approval_status: TaskApprovalStatusType
    status: TaskStatusType
    completion_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verification_status: VerificationOutcomeType
    verification_results: Optional[Dict[str, Any]] = None
    dedup_fingerprint: str
    created_at: datetime
    updated_at: datetime


class TaskFilterParams(BaseModel):
    status: Optional[str] = None
    approval_status: Optional[str] = None
    risk_level: Optional[str] = None
    responsible_role: Optional[str] = None
    assignee_id: Optional[uuid.UUID] = None
    item: Optional[str] = None
    issue_category: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
