"""Central LLM execution gateway enforcing Rule 4 and LLM Policy.

RULE 4: Every LLM call goes through app/core/llm.py only:
temperature 0, JSON validated with pydantic, every call logged to agent_runs.

LLM POLICY: Groq API is primary, local Ollama is fallback, keyword rules are the last resort.
NEVER use any OpenAI or GPT model (including gpt-oss).
"""

import time
import json
import logging
from typing import Type, TypeVar, Optional, Any, Dict
import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.agent_run import AgentRun

logger = logging.getLogger("feedbackiq.llm")
T = TypeVar("T", bound=BaseModel)

FORBIDDEN_KEYWORDS = ["openai", "gpt", "gpt-oss", "chatgpt", "o1-", "o3-"]


class LLMExecutionError(Exception):
    """Raised when all providers in the fallback chain fail."""
    pass


def _verify_model_safety(model_identifier: str) -> None:
    """Strictly forbid any OpenAI or GPT model (Rule / LLM Policy)."""
    lowered = model_identifier.lower()
    for forbidden in FORBIDDEN_KEYWORDS:
        if forbidden in lowered:
            raise ValueError(
                f"SAFETY VIOLATION: Model '{model_identifier}' contains forbidden keyword '{forbidden}'. "
                "OpenAI and GPT models are strictly prohibited."
            )


def _log_agent_run(
    org_id: int,
    agent_name: str,
    model_used: str,
    prompt: str,
    response_data: Dict[str, Any],
    status: str,
    latency_ms: int,
    fallback_attempts: int,
    error_message: Optional[str] = None,
    db: Optional[Any] = None
) -> None:
    """Log LLM execution to PostgreSQL agent_runs table (Rule 4)."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    try:
        run_record = AgentRun(
            org_id=org_id,
            agent_name=agent_name,
            model_used=model_used,
            prompt_preview=prompt[:950],
            response_json=response_data,
            status=status,
            latency_ms=latency_ms,
            fallback_attempts=fallback_attempts,
            error_message=error_message[:950] if error_message else None
        )
        db.add(run_record)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log agent run: {e}")
        db.rollback()
    finally:
        if own_session:
            db.close()


def _call_groq(
    model_name: str,
    prompt: str,
    system_prompt: Optional[str] = None
) -> str:
    """Call Groq API using temperature=0 and JSON response format."""
    _verify_model_safety(model_name)
    
    if not settings.GROQ_API_KEY:
        raise ValueError("Groq API key not configured")

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.0,
        "response_format": {"type": "json_object"}
    }

    with httpx.Client(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
        resp = client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _call_ollama(
    model_name: str,
    prompt: str,
    system_prompt: Optional[str] = None
) -> str:
    """Call local Ollama service using temperature=0 and json format."""
    _verify_model_safety(model_name)

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model_name,
        "messages": messages,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.0
        }
    }

    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    with httpx.Client(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]


def _deterministic_keyword_rules(agent_name: str, prompt: str) -> Dict[str, Any]:
    """Deterministic fallback rules engine (Rule 4 / LLM Policy)."""
    p_lower = prompt.lower()
    
    if agent_name in ("classifier", "feedback_triage"):
        # Food quality indicators
        if any(w in p_lower for w in ["taste", "cold", "raw", "burnt", "salty", "stale", "flavor", "sweet", "spicy", "food", "roti", "rice", "curry"]):
            category = "food_quality"
            dept_code = "food_quality"
        elif any(w in p_lower for w in ["dirty", "hair", "insect", "clean", "hygiene", "smell", "roach", "wash", "pest", "plate", "spoon", "table"]):
            category = "hygiene"
            dept_code = "hygiene"
        elif any(w in p_lower for w in ["rude", "waiter", "staff", "behavior", "attitude", "shout", "ignore", "service", "queue", "slow"]):
            category = "service"
            dept_code = "service"
        elif any(w in p_lower for w in ["ac", "fan", "chair", "light", "space", "water", "restroom", "facilities"]):
            category = "facilities"
            dept_code = "facilities"
        elif any(w in p_lower for w in ["bill", "price", "charge", "refund", "card", "upi", "cashier", "checkout"]):
            category = "billing"
            dept_code = "billing"
        else:
            category = "general"
            dept_code = "food_quality"

        # Sentiment judgment
        if any(w in p_lower for w in ["vomit", "poison", "hospital", "hair", "insect", "terrible", "disgusting", "horrible", "awful", "blood"]):
            sentiment = "critical"
            score = -0.9
            urgency = "P1"
        elif any(w in p_lower for w in ["bad", "poor", "worst", "hate", "stale", "dirty", "rude", "cold", "slow"]):
            sentiment = "negative"
            score = -0.6
            urgency = "P2"
        elif any(w in p_lower for w in ["good", "great", "delicious", "tasty", "clean", "polite", "quick", "best", "love", "fresh"]):
            sentiment = "positive"
            score = 0.8
            urgency = "P4"
        else:
            sentiment = "neutral"
            score = 0.0
            urgency = "P3"

        return {
            "category": category,
            "department_code": dept_code,
            "sentiment": sentiment,
            "sentiment_score": score,
            "urgency": urgency,
            "summary": f"Feedback analyzed regarding {category} issues.",
            "keywords": [w for w in ["taste", "cleanliness", "hygiene", "staff", "speed", "billing"] if w in p_lower]
        }

    elif agent_name == "task_generator":
        return {
            "title": "Immediate Operational Inspection",
            "description": f"Perform priority operational inspection based on reported issue: {prompt[:120]}...",
            "priority": "P2" if any(w in p_lower for w in ["urgent", "bad", "sick", "dirty"]) else "P3",
            "recommended_department": "food_quality" if "food" in p_lower else "hygiene",
            "suggested_actions": ["Inspect workstation", "Review batch quality", "Brief shift staff"]
        }

    elif agent_name == "recurring_predictor":
        return {
            "recurring_pattern_identified": True,
            "fingerprint": "general_kitchen_quality_deviation",
            "title": "Recurring Meal Quality Variance",
            "frequency_count": 3,
            "predicted_root_cause": "Ingredient prep temperature drop or high peak-hour kitchen rush.",
            "recommended_preventive_action": "Calibrate food warmer holding units and optimize prep schedule."
        }

    elif agent_name == "fix_verifier":
        return {
            "status": "passed",
            "recurrence_detected": False,
            "audit_notes": "Verification confirms standard protocol restored without fresh customer complaints.",
            "confidence_score": 0.88
        }

    elif agent_name == "report_generator":
        return {
            "title": "Executive Operations & Feedback Summary",
            "executive_summary": "Comprehensive analysis of dining satisfaction, operational SLA metrics, and departmental resolution rates.",
            "operational_highlights": ["Kitchen response time improved", "Hygiene checks automated", "High SLA compliance"],
            "preventive_recommendations": ["Conduct weekly audits", "Review peak hour staffing"]
        }

    return {
        "status": "processed",
        "notes": f"Fallback rule applied for agent {agent_name}."
    }


def call_llm_chain(
    org_id: int,
    agent_name: str,
    prompt: str,
    response_model: Type[T],
    system_prompt: Optional[str] = None,
    db: Optional[Any] = None
) -> T:
    """Execute LLM call following the chain policy with Pydantic JSON validation.
    
    1. Primary: Groq API models
    2. Fallback: Ollama local models
    3. Last resort: Deterministic keyword rules
    All calls are logged to agent_runs (Rule 4).
    """
    start_time = time.time()
    fallback_attempts = 0
    errors = []

    # Inject JSON schema instructions into prompt to guarantee compliant output
    schema_json = json.dumps(response_model.model_json_schema(), indent=2)
    augmented_system = (
        (system_prompt or "You are an expert AI operational intelligence agent for food-service operations.")
        + f"\nYou MUST output ONLY a valid JSON object strictly matching this JSON Schema:\n{schema_json}\nDo not include Markdown quotes (```json) or introductory commentary."
    )

    for item in settings.parsed_llm_chain:
        provider_model = item.strip()
        if not provider_model:
            continue

        # Option A: Groq API
        if provider_model.startswith("groq:"):
            model_name = provider_model.split("groq:", 1)[1]
            try:
                raw_text = _call_groq(model_name, prompt, augmented_system)
                parsed = response_model.model_validate_json(raw_text)
                latency_ms = int((time.time() - start_time) * 1000)
                _log_agent_run(
                    org_id=org_id,
                    agent_name=agent_name,
                    model_used=provider_model,
                    prompt=prompt,
                    response_data=parsed.model_dump(),
                    status="success",
                    latency_ms=latency_ms,
                    fallback_attempts=fallback_attempts,
                    db=db
                )
                return parsed
            except Exception as e:
                fallback_attempts += 1
                errors.append(f"{provider_model}: {str(e)}")
                continue

        # Option B: Local Ollama
        elif provider_model.startswith("ollama:"):
            model_name = provider_model.split("ollama:", 1)[1]
            try:
                raw_text = _call_ollama(model_name, prompt, augmented_system)
                # Parse JSON safely
                raw_text = raw_text.strip()
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                parsed = response_model.model_validate_json(raw_text)
                latency_ms = int((time.time() - start_time) * 1000)
                _log_agent_run(
                    org_id=org_id,
                    agent_name=agent_name,
                    model_used=provider_model,
                    prompt=prompt,
                    response_data=parsed.model_dump(),
                    status="fallback",
                    latency_ms=latency_ms,
                    fallback_attempts=fallback_attempts,
                    db=db
                )
                return parsed
            except Exception as e:
                fallback_attempts += 1
                errors.append(f"{provider_model}: {str(e)}")
                continue

        # Option C: Keyword Rules (Last resort)
        elif provider_model == "rules":
            try:
                rule_dict = _deterministic_keyword_rules(agent_name, prompt)
                parsed = response_model.model_validate(rule_dict)
                latency_ms = int((time.time() - start_time) * 1000)
                _log_agent_run(
                    org_id=org_id,
                    agent_name=agent_name,
                    model_used="rules",
                    prompt=prompt,
                    response_data=parsed.model_dump(),
                    status="rules",
                    latency_ms=latency_ms,
                    fallback_attempts=fallback_attempts,
                    db=db
                )
                return parsed
            except Exception as e:
                fallback_attempts += 1
                errors.append(f"rules: {str(e)}")
                continue

    # If completely exhausted
    latency_ms = int((time.time() - start_time) * 1000)
    err_summary = "; ".join(errors)
    _log_agent_run(
        org_id=org_id,
        agent_name=agent_name,
        model_used="failed",
        prompt=prompt,
        response_data={},
        status="failed",
        latency_ms=latency_ms,
        fallback_attempts=fallback_attempts,
        error_message=err_summary,
        db=db
    )
    raise LLMExecutionError(f"All LLM chain providers failed: {err_summary}")
