"""Multi-tenant query scoping helper enforcing Rule 1.

RULE 1: Every table has org_id. Every query goes through one org-scoped helper.
Never trust org_id from the client.
"""

from typing import Type, TypeVar, Optional, Any
from sqlalchemy.orm import Session, Query
from sqlalchemy import select

T = TypeVar("T")


class ScopingError(ValueError):
    """Raised when an operation violates tenant scoping."""
    pass


def org_scoped_query(db: Session, model: Type[T], org_id: int) -> Query[T]:
    """Return a Query filtered strictly to the specified tenant org_id.
    
    Raises ScopingError if the model lacks org_id or if org_id is invalid.
    """
    if not isinstance(org_id, int) or org_id <= 0:
        raise ScopingError(f"Invalid org_id: {org_id}. Must be a positive integer.")
        
    if not hasattr(model, "org_id"):
        raise ScopingError(f"Model {model.__name__} does not have an org_id column.")
        
    return db.query(model).filter(model.org_id == org_id)


def scoped_get(db: Session, model: Type[T], org_id: int, ident: int) -> Optional[T]:
    """Retrieve a single entity by primary key, guaranteed to belong to org_id."""
    return org_scoped_query(db, model, org_id).filter(model.id == ident).first()


def scoped_create(
    db: Session,
    model: Type[T],
    org_id: int,
    data: Optional[dict] = None,
    **kwargs: Any
) -> T:
    """Instantiate and attach a new model record with the authoritative org_id.
    
    Any client-provided org_id in data or kwargs is strictly discarded.
    """
    if not isinstance(org_id, int) or org_id <= 0:
        raise ScopingError(f"Invalid org_id: {org_id}. Must be a positive integer.")
        
    merged = dict(data or {})
    merged.update(kwargs)
    merged.pop("org_id", None)  # Never trust client-provided org_id
    
    instance = model(org_id=org_id, **merged)
    db.add(instance)
    return instance


def scoped_filter(db: Session, model: Type[T], org_id: int, *criterion: Any) -> Query[T]:
    """Return an org-scoped query with additional filtering criteria."""
    query = org_scoped_query(db, model, org_id)
    if criterion:
        query = query.filter(*criterion)
    return query


def scoped_delete(db: Session, model: Type[T], org_id: int, ident: int) -> bool:
    """Delete an entity by id, strictly restricted to the specified org_id."""
    instance = scoped_get(db, model, org_id, ident)
    if instance:
        db.delete(instance)
        return True
    return False
