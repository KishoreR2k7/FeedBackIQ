import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization, OrgTemplateType
from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.agents.feedback_analyzer import FeedbackAnalyzerAgent
from app.services.feedback_service import FeedbackService
from app.services.trend_service import TrendService


def make_hash(tag: str) -> str:
    return hashlib.sha256(f"{tag}:{uuid.uuid4()}".encode("utf-8")).hexdigest()


@pytest.mark.asyncio
async def test_sentiment_classification_all_categories():
    """
    Test sentiment classification across all 5 required sentiment states:
    Positive, Negative, Neutral, Mixed, Uncertain.
    """
    # 1. Positive Feedback
    pos = await FeedbackAnalyzerAgent.analyze(
        comment="Masala Dosa was super crispy and sambar was piping hot! Loved it.",
        rating=5,
        item="Masala Dosa",
        meal_type="Breakfast",
    )
    assert pos.sentiment == "positive"
    assert pos.severity_score == 1
    assert pos.food_safety_flag is False
    assert len(pos.issue_categories) == 0

    # 2. Negative Feedback
    neg = await FeedbackAnalyzerAgent.analyze(
        comment="The sambar was freezing cold and the dal was way too salty today.",
        rating=2,
        item="Sambar",
        meal_type="Lunch",
    )
    assert neg.sentiment == "negative"
    assert "temperature" in neg.issue_categories
    assert "taste" in neg.issue_categories
    assert neg.severity_score >= 3
    assert neg.food_safety_flag is False

    # 3. Neutral Feedback
    neu = await FeedbackAnalyzerAgent.analyze(
        comment="Had lunch at the campus canteen today at 1pm.",
        rating=3,
        item="Thali",
        meal_type="Lunch",
    )
    assert neu.sentiment == "neutral"
    assert neu.severity_score == 1

    # 4. Mixed Feedback (both positive aspects and complaints)
    mixed1 = await FeedbackAnalyzerAgent.analyze(
        comment="The chicken biryani was delicious, but the curd rice was sour and stale.",
        rating=3,
        item="Chicken Biryani",
        meal_type="Lunch",
    )
    assert mixed1.sentiment == "mixed"
    assert "freshness" in mixed1.issue_categories
    assert mixed1.severity_score >= 3

    mixed2 = await FeedbackAnalyzerAgent.analyze(
        comment="Great taste and good portion size, however the queue was very slow.",
        rating=3,
        item="Chole Bhature",
        meal_type="Breakfast",
    )
    assert mixed2.sentiment == "mixed"
    assert "service" in mixed2.issue_categories

    # 5. Uncertain Feedback (ambiguous / unsupported claims)
    unc = await FeedbackAnalyzerAgent.analyze(
        comment="Not sure about today's meal, felt quite average.",
        rating=3,
        item=None,
    )
    assert unc.sentiment == "uncertain"
    assert unc.uncertainty_score >= 0.5


@pytest.mark.asyncio
async def test_sarcasm_and_safety_triggers():
    """
    Test sarcasm resolution and critical food safety hazard identification.
    """
    # Sarcasm with cold food complaint
    sarcastic_temp = await FeedbackAnalyzerAgent.analyze(
        comment="Loved the ice-cold tea today, great job kitchen staff!",
        rating=1,
        item="Tea",
    )
    assert sarcastic_temp.sentiment == "negative"
    assert "temperature" in sarcastic_temp.issue_categories

    # Sarcasm with hygiene / pest hazard
    sarcastic_pest = await FeedbackAnalyzerAgent.analyze(
        comment="Thanks for the cockroach in my soup, wonderful 5 star service!",
        rating=1,
        item="Soup",
    )
    assert sarcastic_pest.sentiment == "negative"
    assert sarcastic_pest.food_safety_flag is True
    assert sarcastic_pest.severity_score == 5
    assert any("Pest" in r for r in sarcastic_pest.food_safety_reasons)


@pytest.mark.asyncio
async def test_domain_misspellings_and_transliterations():
    """
    Test resilience to misspellings, colloquial terms, and Indian culinary vocabulary.
    """
    # Misspelled pest ('cokroach') and dish ('daal')
    res1 = await FeedbackAnalyzerAgent.analyze(
        comment="Disgusting! Found a cokroach in my daal!",
        rating=1,
    )
    assert res1.food_safety_flag is True
    assert "Daal" in res1.mentioned_food_items or "Dal" in res1.mentioned_food_items

    # Misspelled illness symptoms ('posioning', 'diahrea')
    res2 = await FeedbackAnalyzerAgent.analyze(
        comment="Got acute food posioning and diahrea after dinner yesterday.",
        rating=1,
    )
    assert res2.food_safety_flag is True
    assert res2.severity_score == 5

    # Dish names like Masala Dosa should not trigger false taste defects
    res3 = await FeedbackAnalyzerAgent.analyze(
        comment="Enjoyed the Masala Dosa for breakfast, excellent taste.",
        rating=5,
    )
    assert res3.sentiment == "positive"
    assert "taste" not in res3.issue_categories


@pytest.mark.asyncio
async def test_empty_comments_and_missing_fields():
    """
    Test handling of empty, whitespace-only comments, and missing optional fields.
    Original text is preserved and rating informs sentiment with high uncertainty.
    """
    # Empty string with high rating -> Positive inferred from rating
    res_empty_pos = await FeedbackAnalyzerAgent.analyze(
        comment="",
        rating=5,
        item=None,
        meal_type=None,
    )
    assert res_empty_pos.sentiment == "positive"
    assert res_empty_pos.food_safety_flag is False

    # Empty string with low rating -> Negative inferred from rating
    res_empty_neg = await FeedbackAnalyzerAgent.analyze(
        comment="   \n\t  ",
        rating=1,
        item=None,
        meal_type=None,
    )
    assert res_empty_neg.sentiment == "negative"
    assert res_empty_neg.severity_score >= 2

    # Whitespace without rating -> Uncertain with high uncertainty score
    res_none = await FeedbackAnalyzerAgent.analyze(
        comment="   ",
        rating=None,
        item=None,
    )
    assert res_none.sentiment == "uncertain"
    assert res_none.uncertainty_score >= 0.8


@pytest.mark.asyncio
async def test_malformed_llm_output_and_provider_failure():
    """
    Verify system resilience when LLM throws an exception or provider fails.
    Must gracefully fallback to deterministic extraction and enforce food safety overrides.
    """
    with patch("app.agents.feedback_analyzer.FeedbackAnalyzerAgent.get_llm") as mock_get_llm:
        class FailingLLM:
            def with_structured_output(self, schema):
                return self
            async def ainvoke(self, messages):
                raise RuntimeError("LLM API connection timed out / rate limited")

        mock_get_llm.return_value = FailingLLM()

        # Feedback contains a critical food safety hazard
        result = await FeedbackAnalyzerAgent.analyze(
            comment="There is a cockroach in the sambar rice and it smells rotten!",
            rating=1,
            item="Sambar Rice",
        )

        # Must not crash, and must catch safety hazard via deterministic fallback
        assert result.sentiment == "negative"
        assert result.food_safety_flag is True
        assert result.severity_score == 5
        assert "Sambar" in result.mentioned_food_items or "Sambar Rice" in result.mentioned_food_items


@pytest.mark.asyncio
async def test_topic_aggregation_sql_python_metrics(db_session: AsyncSession):
    """
    Test SQL/Python calculation of factual topic counts, average ratings,
    negative feedback ratios, and velocity trends over configurable windows.
    """
    org = Organization(
        id=uuid.uuid4(),
        name="Topic Metrics Test Org",
        slug="topic-metrics-org",
        template_type=OrgTemplateType.RESTAURANT,
    )
    db_session.add(org)
    await db_session.commit()

    base_time = datetime.now(timezone.utc)

    # Seed 4 cold food complaints (2 recent, 2 historical)
    for i in range(4):
        fb_date = base_time - timedelta(days=2 if i < 2 else 15)
        fb = Feedback(
            id=uuid.uuid4(),
            organization_id=org.id,
            comment=f"Sambar was ice cold on station {i}",
            rating=2,
            item="Sambar",
            meal_type="Lunch",
            issue_category="temperature",
            date=fb_date,
            content_hash=make_hash(f"sambar-cold-{i}"),
        )
        db_session.add(fb)
        analysis = FeedbackAnalysis(
            feedback_id=fb.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Sambar"],
            service_aspects=["Food serving temperature"],
            issue_categories=["temperature"],
            severity_score=3,
            evidence_quotes=["Sambar was ice cold"],
            food_safety_flag=False,
            model_name="mock",
        )
        db_session.add(analysis)

    # Seed 1 positive feedback for Sambar in temperature category
    fb_pos = Feedback(
        id=uuid.uuid4(),
        organization_id=org.id,
        comment="Sambar was piping hot and temperature was perfect today!",
        rating=5,
        item="Sambar",
        meal_type="Lunch",
        issue_category="temperature",
        date=base_time - timedelta(days=1),
        content_hash=make_hash("sambar-pos"),
    )
    db_session.add(fb_pos)
    analysis_pos = FeedbackAnalysis(
        feedback_id=fb_pos.id,
        organization_id=org.id,
        sentiment="positive",
        mentioned_food_items=["Sambar"],
        service_aspects=["Food serving temperature"],
        issue_categories=["temperature"],
        severity_score=1,
        evidence_quotes=["piping hot"],
        food_safety_flag=False,
        model_name="mock",
    )
    db_session.add(analysis_pos)
    await db_session.commit()

    trends = await TrendService.get_clustered_trends(db_session, org.id, recent_days=7)
    assert len(trends) >= 1
    sambar_topic = next((t for t in trends if t.item == "Sambar"), None)
    assert sambar_topic is not None

    # Check factual metric assertions calculated in SQL/Python
    assert sambar_topic.total_feedback_count == 5
    assert sambar_topic.complaint_count == 4
    assert sambar_topic.positive_count == 1
    # Average rating: (2*4 + 5*1) / 5 = 13 / 5 = 2.6
    assert abs(sambar_topic.average_rating - 2.6) < 0.05
    # Negative feedback ratio: 4 / 5 = 0.8
    assert abs(sambar_topic.negative_feedback_proportion - 0.8) < 0.05
    assert sambar_topic.recent_complaints_count == 2
    assert sambar_topic.historical_complaints_count == 2
    assert sambar_topic.topic_label == "Sambar (Lunch) — Cold Food"
    assert len(sambar_topic.supporting_feedback_ids) == 5


@pytest.mark.asyncio
async def test_supporting_feedback_api(client: AsyncClient, db_session: AsyncSession):
    """
    Test retrieving supporting feedback records for a specific topic cluster via API.
    """
    org = Organization(
        id=uuid.uuid4(),
        name="Supporting Feedback Org",
        slug="supporting-fb-org",
        template_type=OrgTemplateType.COLLEGE,
    )
    db_session.add(org)
    await db_session.commit()

    fb_id = uuid.uuid4()
    fb = Feedback(
        id=fb_id,
        organization_id=org.id,
        comment="Dal was extremely salty on Wednesday lunch",
        rating=1,
        item="Dal Tadka",
        meal_type="Lunch",
        issue_category="taste",
        date=datetime.now(timezone.utc),
        content_hash=make_hash("dal-salty"),
    )
    db_session.add(fb)
    analysis = FeedbackAnalysis(
        feedback_id=fb.id,
        organization_id=org.id,
        sentiment="negative",
        mentioned_food_items=["Dal Tadka"],
        service_aspects=["Flavor balance"],
        issue_categories=["taste"],
        severity_score=3,
        evidence_quotes=["Dal was extremely salty"],
        food_safety_flag=False,
        model_name="mock",
    )
    db_session.add(analysis)
    await db_session.commit()

    # Query supporting feedback for the cluster
    cluster_key = "Dal Tadka|taste|Lunch"
    resp = await client.get(
        f"/api/v1/intelligence/topics/{cluster_key}/feedback",
        headers={"X-Organization-Id": str(org.id)},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["id"] == str(fb_id)
    assert data[0]["item"] == "Dal Tadka"
    assert data[0]["comment"] == "Dal was extremely salty on Wednesday lunch"


@pytest.mark.asyncio
async def test_feedback_filtering_api(client: AsyncClient, db_session: AsyncSession):
    """
    Test listing feedback with filters: sentiment, issue_category, item, date range.
    """
    org = Organization(
        id=uuid.uuid4(),
        name="Filter Test Org",
        slug="filter-test-org",
        template_type=OrgTemplateType.COLLEGE,
    )
    db_session.add(org)
    await db_session.commit()

    t_now = datetime.now(timezone.utc)

    # Record 1: Positive, Masala Dosa
    fb1 = Feedback(
        id=uuid.uuid4(),
        organization_id=org.id,
        comment="Super crispy dosa",
        rating=5,
        item="Masala Dosa",
        meal_type="Breakfast",
        date=t_now - timedelta(days=1),
        content_hash=make_hash("dosa-pos"),
    )
    db_session.add(fb1)
    db_session.add(FeedbackAnalysis(
        feedback_id=fb1.id,
        organization_id=org.id,
        sentiment="positive",
        mentioned_food_items=["Masala Dosa"],
        service_aspects=[],
        issue_categories=[],
        severity_score=1,
        food_safety_flag=False,
        model_name="mock",
    ))

    # Record 2: Negative, Cold Sambar, temperature
    fb2 = Feedback(
        id=uuid.uuid4(),
        organization_id=org.id,
        comment="Freezing cold sambar",
        rating=1,
        item="Sambar",
        issue_category="temperature",
        meal_type="Lunch",
        date=t_now - timedelta(days=5),
        content_hash=make_hash("sambar-neg"),
    )
    db_session.add(fb2)
    db_session.add(FeedbackAnalysis(
        feedback_id=fb2.id,
        organization_id=org.id,
        sentiment="negative",
        mentioned_food_items=["Sambar"],
        service_aspects=[],
        issue_categories=["temperature"],
        severity_score=3,
        food_safety_flag=False,
        model_name="mock",
    ))
    await db_session.commit()

    headers = {"X-Organization-Id": str(org.id)}

    # 1. Filter by sentiment=positive
    r_pos = await client.get("/api/v1/feedback?sentiment=positive", headers=headers)
    assert r_pos.status_code == 200
    pos_items = r_pos.json()["items"]
    assert len(pos_items) == 1
    assert pos_items[0]["item"] == "Masala Dosa"

    # 2. Filter by sentiment=negative
    r_neg = await client.get("/api/v1/feedback?sentiment=negative", headers=headers)
    assert r_neg.status_code == 200
    neg_items = r_neg.json()["items"]
    assert len(neg_items) == 1
    assert neg_items[0]["item"] == "Sambar"

    # 3. Filter by issue_category=temperature
    r_cat = await client.get("/api/v1/feedback?issue_category=temperature", headers=headers)
    assert r_cat.status_code == 200
    cat_items = r_cat.json()["items"]
    assert len(cat_items) == 1
    assert cat_items[0]["item"] == "Sambar"

    # 4. Filter by item=Masala Dosa
    r_item = await client.get("/api/v1/feedback?item=Masala+Dosa", headers=headers)
    assert r_item.status_code == 200
    assert len(r_item.json()["items"]) == 1


@pytest.mark.asyncio
async def test_empty_dataset_graceful_handling(client: AsyncClient, db_session: AsyncSession):
    """
    Test empty datasets return clean empty collections without errors or crashes.
    """
    org = Organization(
        id=uuid.uuid4(),
        name="Empty Tenant",
        slug="empty-tenant",
        template_type=OrgTemplateType.RESTAURANT,
    )
    db_session.add(org)
    await db_session.commit()

    headers = {"X-Organization-Id": str(org.id)}

    # Feedback list should be empty
    r_list = await client.get("/api/v1/feedback", headers=headers)
    assert r_list.status_code == 200
    assert r_list.json()["items"] == []
    assert r_list.json()["total"] == 0

    # Topic trends should be empty
    r_trends = await client.get("/api/v1/intelligence/topics", headers=headers)
    assert r_trends.status_code == 200
    assert r_trends.json() == []

    # Supporting feedback for a non-existent cluster should be empty list
    r_support = await client.get("/api/v1/intelligence/topics/NoItem%7Cgeneral/feedback", headers=headers)
    assert r_support.status_code == 200
    assert r_support.json() == []


@pytest.mark.asyncio
async def test_avoid_reprocessing_unchanged_feedback(db_session: AsyncSession):
    """
    Test that analyze_feedback_item reuses existing analysis unless force_reanalyze=True.
    """
    org = Organization(
        id=uuid.uuid4(),
        name="Cache Test Org",
        slug="cache-test-org",
        template_type=OrgTemplateType.COLLEGE,
    )
    db_session.add(org)
    await db_session.commit()

    fb = Feedback(
        id=uuid.uuid4(),
        organization_id=org.id,
        comment="Paneer was fresh and soft",
        rating=5,
        item="Paneer",
        content_hash=make_hash("paneer-soft"),
    )
    db_session.add(fb)
    await db_session.commit()
    await db_session.refresh(fb)

    # 1. First run creates analysis
    analysis_1 = await FeedbackService.analyze_feedback_item(db_session, fb, force_reanalyze=False)
    assert analysis_1 is not None
    created_at_1 = analysis_1.created_at

    # 2. Second run with force_reanalyze=False should return the exact same persisted record
    analysis_2 = await FeedbackService.analyze_feedback_item(db_session, fb, force_reanalyze=False)
    assert analysis_2.id == analysis_1.id
    assert analysis_2.created_at == created_at_1


@pytest.mark.asyncio
async def test_tenant_isolation_in_feedback_and_topics(db_session: AsyncSession, client: AsyncClient):
    """
    Verify strict tenant isolation: feedback and topics belonging to Tenant A
    are completely inaccessible to Tenant B.
    """
    org_a = Organization(id=uuid.uuid4(), name="Org Alpha", slug="org-alpha", template_type=OrgTemplateType.COLLEGE)
    org_b = Organization(id=uuid.uuid4(), name="Org Beta", slug="org-beta", template_type=OrgTemplateType.RESTAURANT)
    db_session.add_all([org_a, org_b])
    await db_session.commit()

    # Ingest record in Org A
    fb_a = Feedback(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        comment="Cold tea at cafeteria Alpha",
        rating=1,
        item="Tea",
        issue_category="temperature",
        content_hash=make_hash("org-a-tea"),
    )
    db_session.add(fb_a)
    db_session.add(FeedbackAnalysis(
        feedback_id=fb_a.id,
        organization_id=org_a.id,
        sentiment="negative",
        mentioned_food_items=["Tea"],
        service_aspects=[],
        issue_categories=["temperature"],
        severity_score=2,
        food_safety_flag=False,
        model_name="mock",
    ))
    await db_session.commit()

    # Query with Org B header -> Org A records must NOT be visible
    r_b = await client.get("/api/v1/feedback", headers={"X-Organization-Id": str(org_b.id)})
    assert r_b.status_code == 200
    assert len(r_b.json()["items"]) == 0

    # Topics for Org B must be empty
    r_topics_b = await client.get("/api/v1/intelligence/topics", headers={"X-Organization-Id": str(org_b.id)})
    assert r_topics_b.status_code == 200
    assert len(r_topics_b.json()) == 0

    # Query with Org A header -> Record must be present
    r_a = await client.get("/api/v1/feedback", headers={"X-Organization-Id": str(org_a.id)})
    assert r_a.status_code == 200
    assert len(r_a.json()["items"]) == 1
