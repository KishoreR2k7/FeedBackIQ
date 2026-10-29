"""LangGraph Multi-Agent Pipeline for Autonomous Feedback Operations."""

from typing import TypedDict, Optional, Dict, Any, List
from langgraph.graph import StateGraph, END

from app.schemas.agent_schemas import ClassificationOutput, TaskGenerationOutput, RecurringPredictionOutput
from app.agents.classifier import classify_feedback
from app.agents.task_generator import should_generate_task, generate_operational_task, calculate_sla_deadline
from app.agents.recurring_predictor import predict_recurring_issue


class FeedbackPipelineState(TypedDict):
    org_id: int
    raw_text: str
    rating: int
    meal_type: Optional[str]
    location_table: Optional[str]
    department_id: Optional[int]
    department_name: Optional[str]
    recent_category_complaints: List[str]
    frequency_count: int
    classification: Optional[Dict[str, Any]]
    task_output: Optional[Dict[str, Any]]
    recurring_output: Optional[Dict[str, Any]]
    db: Optional[Any]


def classification_step(state: FeedbackPipelineState) -> Dict[str, Any]:
    """Execute Agent 1: Classify feedback category, sentiment, and urgency."""
    result: ClassificationOutput = classify_feedback(
        org_id=state["org_id"],
        raw_text=state["raw_text"],
        rating=state["rating"],
        meal_type=state.get("meal_type"),
        location_table=state.get("location_table"),
        db=state.get("db")
    )
    return {"classification": result.model_dump()}


def task_generation_step(state: FeedbackPipelineState) -> Dict[str, Any]:
    """Execute Agent 2: Generate actionable task if rating or sentiment warrants it."""
    classification_data = state.get("classification")
    if not classification_data:
        return {"task_output": None}

    classification = ClassificationOutput.model_validate(classification_data)
    
    if should_generate_task(state["rating"], classification):
        task_res: TaskGenerationOutput = generate_operational_task(
            org_id=state["org_id"],
            raw_text=state["raw_text"],
            classification=classification,
            department_name=state.get("department_name") or classification.department_code,
            db=state.get("db")
        )
        return {"task_output": task_res.model_dump()}
    
    return {"task_output": None}


def recurring_prediction_step(state: FeedbackPipelineState) -> Dict[str, Any]:
    """Execute Agent 3: Identify recurring patterns across recent complaints."""
    classification_data = state.get("classification")
    recent = state.get("recent_category_complaints", [])
    count = state.get("frequency_count", 1)

    # Only run prediction if there are multiple recent grievances
    if classification_data and (count >= 2 or len(recent) >= 2):
        classification = ClassificationOutput.model_validate(classification_data)
        if classification.sentiment in ("negative", "critical"):
            rec_res: RecurringPredictionOutput = predict_recurring_issue(
                org_id=state["org_id"],
                category=classification.category,
                department_name=state.get("department_name") or classification.department_code,
                recent_complaints=recent,
                frequency_count=count,
                db=state.get("db")
            )
            return {"recurring_output": rec_res.model_dump()}

    return {"recurring_output": None}


def build_feedback_pipeline():
    """Build and compile the LangGraph workflow."""
    workflow = StateGraph(FeedbackPipelineState)

    workflow.add_node("classify", classification_step)
    workflow.add_node("generate_task", task_generation_step)
    workflow.add_node("predict_recurring", recurring_prediction_step)

    workflow.set_entry_point("classify")
    workflow.add_edge("classify", "generate_task")
    workflow.add_edge("generate_task", "predict_recurring")
    workflow.add_edge("predict_recurring", END)

    return workflow.compile()


# Singleton compiled graph
feedback_graph = build_feedback_pipeline()
