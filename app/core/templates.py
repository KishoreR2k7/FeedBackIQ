"""Centralized Jinja2 templates configuration with custom helpers."""

from fastapi.templating import Jinja2Templates
from app.core.permissions import can

templates = Jinja2Templates(directory="app/templates")
templates.env.globals["can"] = can
