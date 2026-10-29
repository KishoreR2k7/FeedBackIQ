import logging
from typing import Dict, Any, Tuple
from app.core.config import settings
from app.schemas.intelligence import PriorityConfigSchema, RiskLevelType

logger = logging.getLogger("feedbackiq.services.priority_engine")

RISK_LEVEL_SCORES: Dict[str, float] = {
    "Critical": 100.0,
    "High": 75.0,
    "Medium": 50.0,
    "Low": 25.0,
    "Insufficient Evidence": 10.0,
}


class PriorityEngine:
    """
    Deterministic, configurable priority engine combining normalized severity,
    recurrence risk, and recent frequency.
    Enforces Rule 9 independent safety overrides for food-safety hazards.
    """

    @classmethod
    def get_default_config(cls) -> PriorityConfigSchema:
        return PriorityConfigSchema(
            w_severity=settings.PRIORITY_WEIGHT_SEVERITY,
            w_recurrence_risk=settings.PRIORITY_WEIGHT_RECURRENCE,
            w_recent_frequency=settings.PRIORITY_WEIGHT_FREQUENCY,
            safety_override_floor=settings.PRIORITY_SAFETY_OVERRIDE_FLOOR,
        )

    @classmethod
    def normalize_severity(cls, avg_severity: float, max_severity: int = 1) -> float:
        """
        Normalizes severity scale (1-5) to 0.0-100.0.
        Blends maximum severity (60%) and average severity (40%) to respect critical single incidents.
        """
        clamped_avg = max(1.0, min(5.0, float(avg_severity)))
        clamped_max = max(1.0, min(5.0, float(max_severity)))
        effective = (0.60 * clamped_max) + (0.40 * clamped_avg)
        normalized = ((effective - 1.0) / 4.0) * 100.0
        return round(max(0.0, min(100.0, normalized)), 1)

    @classmethod
    def normalize_recurrence_risk(cls, risk_level: str) -> float:
        """Maps categorical risk levels to normalized 0-100 values."""
        normalized = RISK_LEVEL_SCORES.get(risk_level, 25.0)
        return float(normalized)

    @classmethod
    def normalize_recent_frequency(cls, recent_complaints: int) -> float:
        """
        Normalizes recent complaint count to 0-100 scale.
        5 or more recent complaints in the window hits 100.0.
        """
        count = max(0, recent_complaints)
        normalized = min(100.0, count * 20.0)
        return round(normalized, 1)

    @classmethod
    def calculate_priority(
        cls,
        avg_severity: float,
        max_severity: int,
        risk_level: str,
        recent_complaints: int,
        has_food_safety_hazard: bool = False,
        config: PriorityConfigSchema = None,
    ) -> Tuple[float, float, float, float, bool]:
        """
        Calculates deterministic priority score:
        Priority = (w_sev * Severity) + (w_rec * RecurrenceRisk) + (w_freq * RecentFrequency)

        Returns:
            (priority_score, norm_severity, norm_recurrence, norm_frequency, is_safety_override)
        """
        cfg = config or cls.get_default_config()

        norm_sev = cls.normalize_severity(avg_severity, max_severity)
        norm_rec = cls.normalize_recurrence_risk(risk_level)
        norm_freq = cls.normalize_recent_frequency(recent_complaints)

        # Linear combination
        raw_priority = (
            (cfg.w_severity * norm_sev)
            + (cfg.w_recurrence_risk * norm_rec)
            + (cfg.w_recent_frequency * norm_freq)
        )
        calculated_priority = round(max(0.0, min(100.0, raw_priority)), 1)

        # Independent Safety Override (Rule 9)
        # Critical food-safety hazards must NEVER be deprioritized due to limited historical frequency.
        is_override = False
        final_priority = calculated_priority
        if has_food_safety_hazard:
            if final_priority < cfg.safety_override_floor:
                final_priority = cfg.safety_override_floor
                is_override = True

        return (final_priority, norm_sev, norm_rec, norm_freq, is_override)
