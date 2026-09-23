"""FastAPI entry point.

Everything the application needs is created once at startup and hung on
`app.state`, so a request handler never constructs a database pool or an HTTP
client of its own. The pieces are injectable, which is how the tests run the
whole stack without a database or a network.

Note what is on `app.state` and what the dependencies expose. The elevated
database and the Auth Admin client live here, because something has to own
them, but no shared dependency hands either of them out. Feature code asking
for a connection receives an actor-scoped one under Row Level Security. The one
sanctioned elevated operation reaches them through its own module's dependency,
so the reach of the secret key is visible in the import graph.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from middleware.errors import ErrorSafetyNetMiddleware, install_error_handlers
from middleware.request_context import RequestIdMiddleware
from modules.activities.router import router as activities_router
from modules.ai.router import router as ai_router
from modules.assessments.router import router as assessments_router
from modules.interventions.router import router as interventions_router
from modules.learning_modules.router import router as learning_modules_router
from modules.progress.router import router as progress_router
from modules.shared.db import Database
from modules.students.router import router as students_router
from modules.teacher_admin.admin_router import router as teacher_admin_admin_router

API_PREFIX = "/api/v1"


def _selected_router(
    source: APIRouter, allowed: dict[str, set[str]]
) -> APIRouter:
    """Return only the route/method pairs with a surviving consumer.

    The existing feature routers remain the implementation owners.  Phase 5
    narrows what the application registers without cloning handlers or
    weakening their dependencies.  Each current route has one HTTP method;
    refusing a mixed-method route keeps a future decorator change from
    accidentally reopening an endpoint that is not in this contract.
    """
    selected = APIRouter()
    for route in source.routes:
        methods = set(getattr(route, "methods", None) or ()) - {"HEAD", "OPTIONS"}
        if methods and methods <= allowed.get(route.path, set()):
            selected.routes.append(route)
    return selected


STUDENT_ROUTES = {
    "/students": {"GET", "POST"},
    "/students/drop": {"POST"},
    "/students/{student_id}": {"GET", "PATCH"},
    "/students/{student_id}/restore": {"POST"},
    "/students/{student_id}/purge-preview": {"GET"},
    "/students/{student_id}/purge": {"POST"},
}

PROGRESS_ROUTES = {
    "/learning-path/me": {"GET"},
    "/progress/{student_id}": {"GET"},
}

LEARNING_MODULE_ROUTES = {
    "/modules/{module_id}": {"GET"},
    "/modules/{module_id}/progress": {"PATCH"},
}

ASSESSMENT_ROUTES = {
    "/assessments": {"GET"},
    "/assessments/{assessment_id}/attempts": {"POST"},
    "/assessment-attempts/{attempt_id}/submit": {"POST"},
}

ACTIVITY_ROUTES = {
    "/activities/{activity_id}": {"GET"},
    "/activities/{activity_id}/attempts": {"POST"},
    "/activity-attempts/{attempt_id}/submit": {"POST"},
}

AI_ROUTES = {
    "/ai/pattern-analysis": {"POST"},
    "/ai/teacher-insight": {"POST"},
}


def _teacher_admin_routes() -> dict[str, set[str]]:
    """Authoring used by bootstrap, plus the surviving UI directories."""
    allowed: dict[str, set[str]] = {
        "/teacher-admin/grades": {"GET"},
        "/teacher-admin/sections": {"GET", "POST"},
    }
    bootstrap_prefixes = (
        "/teacher-admin/competencies",
        "/teacher-admin/modules",
        "/teacher-admin/activities",
        "/teacher-admin/questions",
        "/teacher-admin/assessments",
    )
    for route in teacher_admin_admin_router.routes:
        if route.path.startswith(bootstrap_prefixes):
            allowed.setdefault(route.path, set()).update(
                set(route.methods or ()) - {"HEAD", "OPTIONS"}
            )
    return allowed


def create_app(
    *,
    settings: Settings | None = None,
    token_verifier: Any | None = None,
    database: Any | None = None,
    session_gateway: Any | None = None,
    elevated_database: Any | None = None,
    auth_admin: Any | None = None,
    storage_admin: Any | None = None,
    groq: Any | None = None,
) -> FastAPI:
    """Build the application.

    Every collaborator can be supplied, which is what lets the tests exercise
    real routing, real dependencies and the real error envelope without a
    database or a network.
    """
    resolved = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        await application.state.database.connect()
        if application.state.session_gateway is not None:
            await application.state.session_gateway.connect()
        if application.state.elevated_database is not None:
            await application.state.elevated_database.connect()
        try:
            yield
        finally:
            await application.state.database.disconnect()
            if application.state.session_gateway is not None:
                await application.state.session_gateway.disconnect()
            if application.state.elevated_database is not None:
                await application.state.elevated_database.disconnect()

    application = FastAPI(
        title="MathSmart API",
        version="1.2",
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    application.state.settings = resolved
    application.state.token_verifier = token_verifier or _default_verifier(resolved)
    application.state.database = database or Database(resolved.supabase_db_url)
    # Answers one question — is this token's session still there — and hands out
    # nothing else. Sensitive routes reach it through require_active_session.
    application.state.session_gateway = (
        session_gateway if session_gateway is not None else _default_session_gateway(resolved)
    )
    # Built here because something has to own them, and nowhere else: no shared
    # dependency hands either out. Only modules/students/provisioning.py imports
    # them, and an architecture test keeps it that way.
    application.state.elevated_database = (
        elevated_database
        if elevated_database is not None
        else _default_elevated_database(resolved)
    )
    application.state.storage_admin = (
        storage_admin if storage_admin is not None else _default_storage_admin(resolved)
    )
    application.state.auth_admin = (
        auth_admin if auth_admin is not None else _default_auth_admin(resolved)
    )
    application.state.groq = groq or _default_groq(resolved)

    # Added first, so it ends up innermost: inside RequestIdMiddleware, which
    # gives it the request id, and inside CORSMiddleware, which is what lets a
    # browser read the reply at all.
    application.add_middleware(ErrorSafetyNetMiddleware)
    application.add_middleware(RequestIdMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        # Content-Disposition carries the export's timestamped filename, which
        # the browser can only read if it is exposed.
        expose_headers=["X-Request-Id", "Content-Disposition"],
    )
    install_error_handlers(application)

    @application.get(f"{API_PREFIX}/health", tags=["health"])
    async def health() -> dict[str, Any]:
        """Liveness. Deliberately says nothing about configuration or versions."""
        return {"data": {"status": "ok"}}

    application.include_router(
        _selected_router(students_router, STUDENT_ROUTES), prefix=API_PREFIX
    )
    application.include_router(
        _selected_router(learning_modules_router, LEARNING_MODULE_ROUTES),
        prefix=API_PREFIX,
    )
    application.include_router(
        _selected_router(assessments_router, ASSESSMENT_ROUTES), prefix=API_PREFIX
    )
    application.include_router(
        _selected_router(activities_router, ACTIVITY_ROUTES), prefix=API_PREFIX
    )
    application.include_router(
        _selected_router(progress_router, PROGRESS_ROUTES), prefix=API_PREFIX
    )
    application.include_router(interventions_router, prefix=API_PREFIX)
    application.include_router(
        _selected_router(teacher_admin_admin_router, _teacher_admin_routes()),
        prefix=API_PREFIX,
    )
    application.include_router(_selected_router(ai_router, AI_ROUTES), prefix=API_PREFIX)

    return application


def _default_verifier(settings: Settings) -> Any:
    from middleware.auth import TokenVerifier

    return TokenVerifier(settings)


def _default_session_gateway(settings: Settings) -> Any:
    from modules.shared.session_gateway import SessionGateway

    return SessionGateway(settings.supabase_db_url)


def _default_elevated_database(settings: Settings) -> Any:
    from modules.shared.elevated_db import ElevatedDatabase

    return ElevatedDatabase(settings.supabase_db_url)


def _default_auth_admin(settings: Settings) -> Any:
    from modules.shared.auth_admin import SupabaseAuthAdmin

    return SupabaseAuthAdmin(settings)


def _default_storage_admin(settings: Settings) -> Any:
    from modules.shared.storage_admin import SupabaseStorageAdmin

    return SupabaseStorageAdmin(settings)


def _default_groq(settings: Settings) -> Any:
    from modules.shared.groq_adapter import GroqAdapter

    return GroqAdapter(settings)


app = create_app  # `uvicorn app.main:app --factory`
