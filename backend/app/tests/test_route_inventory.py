"""Phase 5 API surface: retained consumers in, degraded workflows out.

This inspects FastAPI's route table directly.  It deliberately does not use
``TestClient``: route registration is a structural contract and must not start
the application's database lifespan just to prove which endpoints exist.
"""

from app.main import create_app
from modules.shared.testing import fake_settings


def _routes() -> set[tuple[str, str]]:
    application = create_app(settings=fake_settings())
    inventory: set[tuple[str, str]] = set()
    for route in application.routes:
        candidates = (
            route.effective_candidates()
            if hasattr(route, "effective_candidates")
            else [route]
        )
        for candidate in candidates:
            for method in getattr(candidate, "methods", None) or set():
                if method not in {"HEAD", "OPTIONS"}:
                    inventory.add((candidate.path, method))
    return inventory


def test_retained_runtime_and_bootstrap_routes_are_registered() -> None:
    routes = _routes()

    required = {
        # Surviving Teacher/Administrator runtime.
        ("/api/v1/students", "GET"),
        ("/api/v1/students", "POST"),
        ("/api/v1/students/{student_id}", "GET"),
        ("/api/v1/students/{student_id}", "PATCH"),
        ("/api/v1/students/drop", "POST"),
        ("/api/v1/students/{student_id}/restore", "POST"),
        ("/api/v1/students/{student_id}/purge-preview", "GET"),
        ("/api/v1/students/{student_id}/purge", "POST"),
        ("/api/v1/progress/{student_id}", "GET"),
        ("/api/v1/interventions", "GET"),
        ("/api/v1/interventions", "POST"),
        ("/api/v1/interventions/{intervention_id}", "GET"),
        ("/api/v1/interventions/{intervention_id}", "PATCH"),
        ("/api/v1/interventions/{intervention_id}", "DELETE"),
        ("/api/v1/interventions/{intervention_id}/ai-suggestion", "POST"),
        ("/api/v1/interventions/{intervention_id}/ai-suggestion", "DELETE"),
        ("/api/v1/ai/pattern-analysis", "POST"),
        ("/api/v1/ai/teacher-insight", "POST"),
        ("/api/v1/teacher-admin/grades", "GET"),
        ("/api/v1/teacher-admin/sections", "GET"),
        ("/api/v1/teacher-admin/competencies", "GET"),
        # Local bootstrap still creates deterministic evidence through these
        # endpoints. They remain until that bootstrap contract is replaced.
        ("/api/v1/teacher-admin/competencies", "POST"),
        ("/api/v1/teacher-admin/modules", "POST"),
        ("/api/v1/teacher-admin/questions", "POST"),
        ("/api/v1/teacher-admin/activities", "POST"),
        ("/api/v1/teacher-admin/assessments", "POST"),
        ("/api/v1/teacher-admin/sections", "POST"),
        ("/api/v1/assessments", "GET"),
        ("/api/v1/assessments/{assessment_id}/attempts", "POST"),
        ("/api/v1/assessment-attempts/{attempt_id}/submit", "POST"),
        ("/api/v1/learning-path/me", "GET"),
        ("/api/v1/modules/{module_id}", "GET"),
        ("/api/v1/modules/{module_id}/progress", "PATCH"),
        ("/api/v1/activities/{activity_id}", "GET"),
        ("/api/v1/activities/{activity_id}/attempts", "POST"),
        ("/api/v1/activity-attempts/{attempt_id}/submit", "POST"),
    }

    assert required <= routes


def test_removed_workflow_routes_are_not_registered() -> None:
    routes = _routes()

    removed = {
        ("/api/v1/auth/me", "GET"),
        ("/api/v1/auth/me", "PATCH"),
        ("/api/v1/students/me", "GET"),
        ("/api/v1/students/me", "PATCH"),
        ("/api/v1/competencies", "GET"),
        ("/api/v1/progress/me", "GET"),
        ("/api/v1/learning-path/{student_id}", "GET"),
        ("/api/v1/modules", "GET"),
        ("/api/v1/modules/{module_id}/complete", "POST"),
        ("/api/v1/modules/{module_id}/progress/{student_id}", "GET"),
        ("/api/v1/activities", "GET"),
        ("/api/v1/activity-attempts/{attempt_id}/answer-checks", "POST"),
        ("/api/v1/activity-attempts/{attempt_id}/hints", "POST"),
        ("/api/v1/assessment-attempts/me", "GET"),
        ("/api/v1/diagnostic-status/me", "GET"),
        ("/api/v1/assessment-attempts/{attempt_id}", "PATCH"),
        ("/api/v1/assessment-attempts/{attempt_id}", "GET"),
        ("/api/v1/assessment-attempts/{attempt_id}/review", "GET"),
        ("/api/v1/ai/student-feedback", "POST"),
        ("/api/v1/ai/incorrect-answer-explanation", "POST"),
        ("/api/v1/ai/remediation-support", "POST"),
        ("/api/v1/teacher-admin/dashboard", "GET"),
        ("/api/v1/teacher-admin/analytics", "GET"),
        ("/api/v1/teacher-admin/reports/overview", "GET"),
        ("/api/v1/teacher-admin/reports/summary", "GET"),
        ("/api/v1/teacher-admin/users", "GET"),
        ("/api/v1/teacher-admin/settings", "GET"),
        ("/api/v1/teacher-admin/audit-events", "GET"),
        ("/api/v1/teacher-admin/grades", "POST"),
        ("/api/v1/teacher-admin/sections/{section_id}", "PATCH"),
    }

    assert routes.isdisjoint(removed)
