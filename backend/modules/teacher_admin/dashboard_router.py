"""Teacher/Administrator dashboard and section directory reads."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Query

from app.dependencies import ActorDb, TeacherAdmin
from modules.teacher_admin import dashboard_repository as repository
from modules.teacher_admin import service

router = APIRouter(tags=["teacher-admin"])


DEFAULT_PAGE_SIZE = 50


RECENT_ACTIVITY_LIMIT = 8


def _number(value: Any) -> float | None:
    return None if value is None else float(value)


def _learner(row: Any) -> dict[str, Any]:
    return {
        "student_id": str(row["student_id"]),
        "learner_id": row["learner_id"],
        "full_name": row["full_name"],
        "grade_id": str(row["grade_id"]) if row["grade_id"] else None,
        "section_id": str(row["section_id"]) if row["section_id"] else None,
        "section_name": row["section_name"],
        "diagnostic_status": (
            str(row["diagnostic_status"]) if row["diagnostic_status"] else None
        ),
        "diagnostic_score": _number(row["diagnostic_average"]),
        "overall_mastery": _number(row["current_average"]),
        "competencies_mastered": row["competencies_mastered"] or 0,
        "modules_completed_count": row["modules_completed"] or 0,
        "monitoring_status": (
            str(row["monitoring_status"]) if row["monitoring_status"] else None
        ),
        "active_intervention_count": row["open_intervention_count"] or 0,
    }


def _competency(row: Any) -> dict[str, Any]:
    """A competency rollup, with the average withheld for a small cohort."""
    hidden = service.suppressed(row["current_contributors"])
    diagnostic_hidden = service.suppressed(row["diagnostic_contributors"])
    return {
        "competency_id": str(row["competency_id"]),
        "code": row["code"],
        "name": row["name"],
        "domain": row["domain"],
        "status": str(row["status"]),
        "learners_tracked": row["learners_tracked"] or 0,
        "mastered_count": row["mastered_count"] or 0,
        "developing_count": row["developing_count"] or 0,
        "needs_improvement_count": row["needs_improvement_count"] or 0,
        "average_current_score": (
            None if hidden else _number(row["average_current_score"])
        ),
        "average_diagnostic_score": (
            None if diagnostic_hidden else _number(row["average_diagnostic_score"])
        ),
        "growth": (
            None
            if hidden or diagnostic_hidden
            else service.growth(
                row["average_current_score"], row["average_diagnostic_score"]
            )
        ),
        # Withheld with the average it was drawn from: a band is the average
        # rounded to three words, and just as identifying in a small cohort.
        "average_mastery_band": (
            None
            if hidden or row["average_mastery_band"] is None
            else str(row["average_mastery_band"])
        ),
        "suppressed": hidden,
    }


def _recent(row: Any) -> dict[str, Any]:
    return {
        "kind": row["kind"],
        "id": str(row["activity_id"]),
        "student_id": str(row["student_id"]),
        "learner_id": row["learner_id"],
        "full_name": row["full_name"],
        "title": row["title"],
        "score": _number(row["score"]),
        "occurred_at": row["occurred_at"].isoformat() if row["occurred_at"] else None,
    }


@router.get("/teacher-admin/dashboard")
async def read_dashboard(
    _actor: TeacherAdmin,
    connection: ActorDb,
    grade_id: Annotated[UUID | None, Query()] = None,
    section_id: Annotated[UUID | None, Query()] = None,
) -> dict[str, Any]:
    """Cohort totals, the competency overview, and the learners who need support.

    Every figure is the database's, scoped to the same cohort. The breakdown
    beside the totals — sections, where each learner's diagnostic stands, and
    interventions by status — is counted in SQL, and recent activity is the
    work the database already scored. Nothing here is estimated, and nothing
    is derived from advisory text.

    The competency overview is published competencies only. A draft is not
    being taught and an archived one no longer is, and listing them turned a
    class summary into a list of every row ever written.
    """
    totals = await repository.dashboard(
        connection, grade_id=grade_id, section_id=section_id
    )
    breakdown = await repository.dashboard_breakdown(
        connection, grade_id=grade_id, section_id=section_id
    )
    competency_rows = await repository.competencies(
        connection, grade_id=grade_id, section_id=section_id, published_only=True
    )
    recent_rows = await repository.recent_activity(
        connection,
        grade_id=grade_id,
        section_id=section_id,
        limit=RECENT_ACTIVITY_LIMIT,
    )
    priority = await repository.learners(
        connection,
        grade_id=grade_id,
        section_id=section_id,
        at_risk_only=True,
        limit=DEFAULT_PAGE_SIZE,
        offset=0,
    )

    return {
        "data": {
            "totals": {
                "learner_count": totals["learner_count"] or 0,
                "active_count": totals["active_count"] or 0,
                "needs_support_count": totals["needs_support_count"] or 0,
                "improving_count": totals["improving_count"] or 0,
                "mastered_count": totals["mastered_count"] or 0,
                # Withheld, like every other average, when it would describe
                # fewer than five learners.
                "average_mastery": (
                    None
                    if service.suppressed(totals["learners_with_scores"])
                    else _number(totals["average_mastery"])
                ),
                "average_mastery_suppressed": service.suppressed(
                    totals["learners_with_scores"]
                ),
                "open_intervention_count": totals["open_intervention_count"] or 0,
                "published_competency_count": totals["published_competency_count"] or 0,
                "scored_attempt_count": totals["scored_attempt_count"] or 0,
                "completed_module_count": totals["completed_module_count"] or 0,
                "section_count": breakdown["section_count"] or 0,
            },
            "diagnostic": {
                "not_started": breakdown["diagnostic_not_started"] or 0,
                "in_progress": breakdown["diagnostic_in_progress"] or 0,
                "completed": breakdown["diagnostic_completed"] or 0,
            },
            "interventions": {
                "needs_intervention": breakdown["interventions_needs_intervention"] or 0,
                "in_progress": breakdown["interventions_in_progress"] or 0,
                "resolved": breakdown["interventions_resolved"] or 0,
            },
            "competencies": [_competency(row) for row in competency_rows],
            "priority_learners": [_learner(row) for row in priority],
            "recent_activity": [_recent(row) for row in recent_rows],
        }
    }


@router.get("/teacher-admin/classes")
async def list_classes(
    _actor: TeacherAdmin,
    connection: ActorDb,
    grade_id: Annotated[UUID | None, Query()] = None,
) -> dict[str, Any]:
    """The permitted sections, with their adviser and cohort shape."""
    rows = await repository.sections(connection, grade_id=grade_id)
    return {
        "data": [
            {
                "id": str(row["section_id"]),
                "grade_id": str(row["grade_id"]) if row["grade_id"] else None,
                "name": row["section_name"],
                "is_active": bool(row["is_active"]),
                "adviser": {
                    "id": str(row["adviser_id"]) if row["adviser_id"] else None,
                    "full_name": row["adviser_name"],
                },
                "learner_count": row["learner_count"] or 0,
            }
            for row in rows
        ]
    }
