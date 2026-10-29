"""Tests for Rule 4: LLM Policy, Safety, and Fallback Gateway."""

import pytest
from pydantic import BaseModel
from app.core.llm import (
    call_llm_chain,
    _verify_model_safety,
    _deterministic_keyword_rules,
    LLMExecutionError,
)
from app.models.agent_run import AgentRun


from typing import Literal

class SampleClassificationSchema(BaseModel):
    category: Literal["food_quality", "hygiene", "service", "facilities", "billing", "general"]
    department_code: str
    sentiment: Literal["positive", "neutral", "negative", "critical"]
    sentiment_score: float
    urgency: Literal["P1", "P2", "P3", "P4"]
    summary: str


def test_forbidden_models_are_rejected():
    """Verify that any OpenAI or GPT model is strictly rejected (LLM Policy)."""
    forbidden_list = [
        "openai/gpt-4o",
        "gpt-4-turbo",
        "gpt-oss:120b-cloud",
        "ollama:gpt-oss",
        "chatgpt-3.5",
        "groq:o1-preview"
    ]
    for model in forbidden_list:
        with pytest.raises(ValueError) as excinfo:
            _verify_model_safety(model)
        assert "SAFETY VIOLATION" in str(excinfo.value)


def test_allowed_models_pass_safety_check():
    """Verify approved open models pass safety validation."""
    allowed = [
        "groq:qwen/qwen3.8-27b",
        "groq:llama-3.3-70b-versatile",
        "ollama:gemma3:4b",
        "ollama:llama3:8b",
        "ollama:qwen2.5:1.5b",
        "rules"
    ]
    for model in allowed:
        _verify_model_safety(model)  # Should not raise


def test_keyword_rules_engine_food_quality():
    """Verify deterministic keyword rules categorize food issues accurately."""
    res = _deterministic_keyword_rules(
        "classifier",
        "The lunch rice and sambar was completely cold and tasted burnt."
    )
    assert res["category"] == "food_quality"
    assert res["department_code"] == "food_quality"
    assert res["sentiment"] in ("negative", "critical")


def test_keyword_rules_engine_hygiene_critical():
    """Verify critical hygiene alerts receive P1 priority."""
    res = _deterministic_keyword_rules(
        "classifier",
        "Terrible! Found a dead insect inside my soup plate!"
    )
    assert res["category"] == "hygiene"
    assert res["urgency"] == "P1"
    assert res["sentiment"] == "critical"


def test_llm_chain_executes_and_logs(test_org, test_db):
    """Verify call_llm_chain returns validated Pydantic model and logs to agent_runs."""
    prompt = "The dinner roti was hard and stale, cold dal."
    result = call_llm_chain(
        org_id=test_org.id,
        agent_name="classifier",
        prompt=prompt,
        response_model=SampleClassificationSchema,
        db=test_db
    )

    assert isinstance(result, SampleClassificationSchema)
    assert result.category == "food_quality"
    assert result.sentiment in ("negative", "critical")

    # Verify agent_runs logging (Rule 4)
    run_log = test_db.query(AgentRun).filter(AgentRun.org_id == test_org.id).order_by(AgentRun.id.desc()).first()
    assert run_log is not None
    assert run_log.agent_name == "classifier"
    assert run_log.status in ("success", "fallback", "rules")
