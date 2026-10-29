import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "FeedbackIQ"
    assert data["version"] == "0.1.0"
    assert "docs_url" in data


@pytest.mark.asyncio
async def test_root_health_liveness(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "FeedbackIQ"


@pytest.mark.asyncio
async def test_api_v1_health_liveness(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_readiness(client: AsyncClient):
    response = await client.get("/health/ready")
    # In test context with mock/test DB, readiness returns valid structure
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ready", "not_ready"]
    assert "checks" in data
    assert "llm_engine" in data["checks"]
