import uuid
from typing import Any, Generic, List, Optional, Type, TypeVar
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic asynchronous repository for clean data access patterns.
    Supports tenant-isolated queries.
    """

    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db

    async def get_by_id(self, id: uuid.UUID) -> Optional[ModelType]:
        stmt = select(self.model).where(self.model.id == id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        organization_id: Optional[uuid.UUID] = None,
    ) -> List[ModelType]:
        stmt = select(self.model)
        if organization_id and hasattr(self.model, "organization_id"):
            stmt = stmt.where(self.model.organization_id == organization_id)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj: ModelType) -> ModelType:
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete_by_id(self, id: uuid.UUID) -> bool:
        stmt = delete(self.model).where(self.model.id == id)
        result = await self.db.execute(stmt)
        return result.rowcount > 0
