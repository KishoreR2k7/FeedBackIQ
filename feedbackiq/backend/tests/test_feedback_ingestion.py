import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization, OrgTemplateType
from app.models.feedback import Feedback
from app.agents.feedback_analyzer import FeedbackAnalyzerAgent
from app.services.synthetic_generator import SyntheticDataGenerator
from app.services.ingestion_service import IngestionService
from app.services.feedback_service import FeedbackService
from app.schemas.feedback import FeedbackCreate


@pytest.mark.asyncio
async def test_synthetic_feedback_generation(db_session: AsyncSession):
    # Setup test organization
    org = Organization(
        id=uuid.uuid4(),
        name="Test Engineering Campus",
        slug="test-eng-campus",
        template_type=OrgTemplateType.COLLEGE,
    )
    db_session.add(org)
    await db_session.commit()

    # Generate synthetic data with seeded recurring scenarios
    records = await FeedbackService.generate_synthetic_data(
        db=db_session,
        organization_id=org.id,
        count=30,
        seed_recurring=True,
    )

    assert len(records) > 0
    sample = records[0]
    assert sample.organization_id == org.id
    assert sample.meal_type in ["Breakfast", "Lunch", "Evening Snacks", "Dinner", None]
    assert sample.rating is not None and 1 <= sample.rating <= 5
    assert sample.content_hash is not None


@pytest.mark.asyncio
async def test_csv_upload_and_mapping(db_session: AsyncSession):
    org = Organization(
        id=uuid.uuid4(),
        name="Gourmet Dining",
        slug="gourmet-dining",
        template_type=OrgTemplateType.RESTAURANT,
    )
    db_session.add(org)
    await db_session.commit()

    sample_csv = """dish_name,meal_slot,score,review_text,issue
Dal Tadka,Lunch,2,Dal was cold and tasteless,Temperature
Paneer Tikka,Dinner,5,Amazing smoky aroma and soft paneer,
Masala Chai,Breakfast,1,Found a hair on the glass rim,Hygiene
"""

    job = await IngestionService.process_csv_content(
        db=db_session,
        csv_text=sample_csv,
        organization_id=org.id,
        filename="test_feedback.csv",
    )

    assert job.status.value == "completed"
    assert job.successful_records == 3
    assert job.duplicate_records == 0

    # Query persisted feedback
    stmt = select(Feedback).where(Feedback.organization_id == org.id)
    res = await db_session.execute(stmt)
    persisted = list(res.scalars().all())
    assert len(persisted) == 3

    # Check mapping
    chai_fb = next(f for f in persisted if "Chai" in (f.item or ""))
    assert chai_fb.rating == 1
    assert chai_fb.issue_category == "Hygiene"


@pytest.mark.asyncio
async def test_csv_duplicate_handling(db_session: AsyncSession):
    org = Organization(
        id=uuid.uuid4(),
        name="Corporate Food Hub",
        slug="corp-food-hub",
        template_type=OrgTemplateType.CORPORATE_CAFETERIA,
    )
    db_session.add(org)
    await db_session.commit()

    sample_csv = """item,rating,comment
Veg Biryani,4,Good portion size
Veg Biryani,4,Good portion size
Veg Biryani,4,Good portion size
"""

    # First ingest
    job1 = await IngestionService.process_csv_content(
        db=db_session,
        csv_text=sample_csv,
        organization_id=org.id,
        filename="batch1.csv",
    )
    assert job1.successful_records == 1
    assert job1.duplicate_records == 2

    # Second ingest of same data -> All duplicates
    job2 = await IngestionService.process_csv_content(
        db=db_session,
        csv_text=sample_csv,
        organization_id=org.id,
        filename="batch2.csv",
    )
    assert job2.successful_records == 0
    assert job2.duplicate_records == 3


@pytest.mark.asyncio
async def test_zomato_dataset_mapping(db_session: AsyncSession):
    org = Organization(
        id=uuid.uuid4(),
        name="Bangalore Eateries",
        slug="blr-eateries",
        template_type=OrgTemplateType.RESTAURANT,
    )
    db_session.add(org)
    await db_session.commit()

    # Emulate Zomato Bangalore Kaggle structure
    zomato_csv = """name,rate,cuisines,dish_liked,reviews_list
Empire Restaurant,4.1/5,North Indian,Chicken Biryani,[('Rated 4.0', 'RATED\\n  Biryani was flavorful and chicken tender')]
Truffles,4.7/5,American,All American Burger,[('Rated 5.0', 'RATED\\n  Best burger in Koramangala')]
"""

    job = await IngestionService.process_csv_content(
        db=db_session,
        csv_text=zomato_csv,
        organization_id=org.id,
        filename="zomato.csv",
    )

    assert job.status.value == "completed"
    assert job.successful_records == 2

    # Verify no invented fields: meal_type and date must be None
    stmt = select(Feedback).where(Feedback.organization_id == org.id)
    res = await db_session.execute(stmt)
    zom_records = list(res.scalars().all())
    for r in zom_records:
        assert r.meal_type is None
        assert r.source_dataset == "zomato_bangalore"
        assert r.rating in [4, 5]


@pytest.mark.asyncio
async def test_feedback_analysis_agent_structured_output():
    # 1. Negative & Temperature Aspect
    res1 = await FeedbackAnalyzerAgent.analyze(
        comment="The sambar was freezing cold and the dal was way too salty today.",
        rating=2,
        item="Sambar Rice",
        meal_type="Lunch",
    )
    assert res1.sentiment == "negative"
    assert "temperature" in res1.issue_categories
    assert "taste" in res1.issue_categories
    assert res1.severity_score >= 3
    assert res1.food_safety_flag is False

    # 2. Positive Feedback
    res2 = await FeedbackAnalyzerAgent.analyze(
        comment="Masala Dosa was super crispy and sambar was piping hot! Loved it.",
        rating=5,
        item="Masala Dosa",
        meal_type="Breakfast",
    )
    assert res2.sentiment == "positive"
    assert res2.severity_score == 1
    assert res2.food_safety_flag is False


@pytest.mark.asyncio
async def test_deterministic_safety_escalation_rule_9():
    """
    Rule 9: Critical safety complaints must trigger deterministic escalation rules;
    an LLM must never suppress them.
    """
    # Safety Case A: Cockroach / Pest
    res_pest = await FeedbackAnalyzerAgent.analyze(
        comment="Found a cockroach inside the lunch rice bowl! Disgusting.",
        rating=1,
    )
    assert res_pest.food_safety_flag is True
    assert res_pest.severity_score >= 4
    assert any("Pest" in r for r in res_pest.food_safety_reasons)

    # Safety Case B: Food poisoning / Illness
    res_illness = await FeedbackAnalyzerAgent.analyze(
        comment="Had severe food poisoning and vomiting after eating the paneer curry.",
        rating=1,
    )
    assert res_illness.food_safety_flag is True
    assert res_illness.severity_score == 5

    # Safety Case C: Sarcastic review with raw poultry hazard
    res_sarcasm = await FeedbackAnalyzerAgent.analyze(
        comment="Wonderful job kitchen staff, loved the pink raw chicken in my biryani!",
        rating=1,
    )
    assert res_sarcasm.sentiment == "negative"
    assert res_sarcasm.food_safety_flag is True


@pytest.mark.asyncio
async def test_feedback_tenant_isolation(db_session: AsyncSession):
    org_a = Organization(id=uuid.uuid4(), name="Campus Alpha", slug="campus-alpha", template_type=OrgTemplateType.COLLEGE)
    org_b = Organization(id=uuid.uuid4(), name="Campus Beta", slug="campus-beta", template_type=OrgTemplateType.COLLEGE)
    db_session.add_all([org_a, org_b])
    await db_session.commit()

    # Create feedback for Org A
    fb_a = Feedback(
        id=uuid.uuid4(),
        organization_id=org_a.id,
        item="Upma",
        rating=3,
        comment="Upma was dry",
        content_hash="hash_a",
    )
    # Create feedback for Org B
    fb_b = Feedback(
        id=uuid.uuid4(),
        organization_id=org_b.id,
        item="Puri",
        rating=4,
        comment="Puri was fine",
        content_hash="hash_b",
    )
    db_session.add_all([fb_a, fb_b])
    await db_session.commit()

    # Org A query
    page_a = await FeedbackService.list_feedback(db_session, organization_id=org_a.id)
    assert page_a.total == 1
    assert page_a.items[0].item == "Upma"

    # Org B query
    page_b = await FeedbackService.list_feedback(db_session, organization_id=org_b.id)
    assert page_b.total == 1
    assert page_b.items[0].item == "Puri"

    # Cross-tenant guarantee
    assert fb_b.id not in [i.id for i in page_a.items]
