from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    organizations,
    feedback,
    intelligence,
    tasks,
    notifications,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(organizations.router)
api_router.include_router(feedback.router)
api_router.include_router(intelligence.router)
api_router.include_router(tasks.router)
api_router.include_router(notifications.router)
