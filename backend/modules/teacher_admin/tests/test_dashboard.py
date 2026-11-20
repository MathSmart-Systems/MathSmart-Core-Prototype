"""The teacher dashboard reports recorded, actor-scoped learner evidence."""

from uuid import UUID

from modules.shared.testing import (
    ADVISER_HEADERS,
    LEARNER_HEADERS,
    FakeConnection,
    build_client,
)

SECTION = UUID("cc7ef387-7435-4af0-8c50-0a7ce6aa5f5c")


GRADE = UUID("3f0f0000-0000-4000-8000-000000000006")


COMPETENCY = UUID("13ec5f06-746e-45fb-a58a-92f4ce42621c")


STUDENT_ID = UUID("58000000-0000-4000-8000-000000000001")


BREAKDOWN = "as section_count"


RECENT = "union all"


DASHBOARD = "scoped_learners"


SECTIONS = "from app.section_performance_summary"


LEARNERS = "from app.student_performance_summary"


COMPETENCIES = "as learners_tracked"


DASHBOARD_ROW = {
    "learner_count": 40,
    "active_count": 22,
    "needs_support_count": 9,
    "improving_count": 6,
    "mastered_count": 3,
    "average_mastery": 63,
    "learners_with_scores": 40,
    "open_intervention_count": 4,
    "published_competency_count": 12,
    "scored_attempt_count": 38,
    "completed_module_count": 51,
}


SECTION_ROW = {
    "section_id": SECTION,
    "grade_id": GRADE,
    "section_name": "Rizal",
    "adviser_id": UUID("4c000000-0000-4000-8000-000000000001"),
    "adviser_name": "Maria Santos",
    "is_active": True,
    "learner_count": 20,
    "active_count": 11,
    "needs_intervention_count": 5,
    "improving_count": 3,
    "mastered_count": 1,
    "inactive_count": 0,
    "average_current_score": 61,
}


LEARNER_ROW = {
    "student_id": STUDENT_ID,
    "learner_id": "STU-2026-001",
    "full_name": "Juan Dela Cruz",
    "grade_id": GRADE,
    "section_id": SECTION,
    "section_name": "Rizal",
    "monitoring_status": "needs_intervention",
    "diagnostic_status": "completed",
    "diagnostic_average": 48,
    "current_average": 63,
    "competencies_mastered": 1,
    "modules_completed": 1,
    "modules_started": 3,
    "scored_attempt_count": 2,
    "worst_unsuccessful_attempts": 2,
    "open_intervention_count": 1,
    "last_studied_at": None,
}


COMPETENCY_ROW = {
    "competency_id": COMPETENCY,
    "code": "MATH6-INT-02",
    "name": "Multiplication and Division of Integers",
    "domain": "Number Sense",
    "grade_id": GRADE,
    "status": "published",
    "learners_tracked": 20,
    "mastered_count": 4,
    "developing_count": 10,
    "needs_improvement_count": 6,
    "average_current_score": 58,
    "average_diagnostic_score": 41,
    "average_mastery_band": "Developing",
}


BREAKDOWN_ROW = {
    "section_count": 3,
    "diagnostic_not_started": 5,
    "diagnostic_in_progress": 2,
    "diagnostic_completed": 33,
    "interventions_needs_intervention": 2,
    "interventions_in_progress": 2,
    "interventions_resolved": 7,
}


RECENT_ROW = {
    "kind": "assessment",
    "activity_id": UUID("8a000000-0000-4000-8000-000000000001"),
    "student_id": STUDENT_ID,
    "learner_id": "STU-2026-001",
    "full_name": "Juan Dela Cruz",
    "title": "Diagnostic Assessment",
    "score": 72,
    "occurred_at": None,
}


def reporting_connection(**overrides):
    results = {
        BREAKDOWN: BREAKDOWN_ROW,
        RECENT: [RECENT_ROW],
        DASHBOARD: DASHBOARD_ROW,
        SECTIONS: [SECTION_ROW],
        LEARNERS: [LEARNER_ROW],
        COMPETENCIES: [COMPETENCY_ROW],
    }
    results.update(overrides)
    return FakeConnection(results=results)


def test_the_dashboard_reports_the_cohort():
    client = build_client(reporting_connection())

    response = client.get("/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["totals"]["learner_count"] == 40
    assert data["totals"]["needs_support_count"] == 9
    assert data["totals"]["average_mastery"] == 63
    assert data["competencies"][0]["code"] == "MATH6-INT-02"


def test_a_learner_cannot_read_the_dashboard():
    client = build_client(reporting_connection())

    response = client.get("/api/v1/teacher-admin/dashboard", headers=LEARNER_HEADERS)

    assert response.status_code == 403


def test_classes_report_their_adviser():
    client = build_client(reporting_connection())

    response = client.get("/api/v1/teacher-admin/classes", headers=ADVISER_HEADERS)

    assert response.status_code == 200
    section = response.json()["data"][0]
    assert section["name"] == "Rizal"
    assert section["adviser"]["full_name"] == "Maria Santos"
    assert section["learner_count"] == 20


def _args_for(connection, fragment):
    matched = [args for statement, args in connection.calls if fragment in statement]
    assert matched, fragment
    return matched[0]


def test_the_dashboard_totals_honour_the_grade_and_section_filters():
    connection = reporting_connection()
    client = build_client(connection)

    response = client.get(
        "/api/v1/teacher-admin/dashboard",
        params={"grade_id": str(GRADE), "section_id": str(SECTION)},
        headers=ADVISER_HEADERS,
    )

    assert response.status_code == 200
    assert _args_for(connection, DASHBOARD) == (GRADE, SECTION)


def test_the_dashboard_competencies_honour_the_section_filter():
    connection = reporting_connection()
    client = build_client(connection)

    client.get(
        "/api/v1/teacher-admin/dashboard",
        params={"grade_id": str(GRADE), "section_id": str(SECTION)},
        headers=ADVISER_HEADERS,
    )

    # The third argument is the published-only switch. The dashboard turns it
    # on: a draft is not being taught, and a class summary listed every row.
    assert _args_for(connection, COMPETENCIES) == (GRADE, SECTION, True)


def test_the_dashboard_counts_sections_and_diagnostics():
    client = build_client(reporting_connection())

    data = client.get("/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS).json()["data"]

    assert data["totals"]["section_count"] == 3
    assert data["diagnostic"] == {"not_started": 5, "in_progress": 2, "completed": 33}


def test_the_dashboard_splits_interventions_by_status():
    client = build_client(reporting_connection())

    data = client.get("/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS).json()["data"]

    # Three statuses, three numbers. A single "open" count could not tell a
    # teacher how much of it was waiting and how much was already in hand.
    assert data["interventions"] == {"needs_intervention": 2, "in_progress": 2, "resolved": 7}


def test_the_dashboard_lists_recent_scored_work():
    client = build_client(reporting_connection())

    data = client.get("/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS).json()["data"]

    assert data["recent_activity"] == [
        {
            "kind": "assessment",
            "id": "8a000000-0000-4000-8000-000000000001",
            "student_id": str(STUDENT_ID),
            "learner_id": "STU-2026-001",
            "full_name": "Juan Dela Cruz",
            "title": "Diagnostic Assessment",
            "score": 72,
            "occurred_at": None,
        }
    ]


def test_the_dashboard_breakdown_honours_the_grade_and_section_filters():
    connection = reporting_connection()
    client = build_client(connection)

    client.get(
        "/api/v1/teacher-admin/dashboard",
        params={"grade_id": str(GRADE), "section_id": str(SECTION)},
        headers=ADVISER_HEADERS,
    )

    # Every number on the page narrows together, or a filtered page would mix
    # a section's learners with the whole school's interventions.
    assert _args_for(connection, BREAKDOWN) == (GRADE, SECTION)
    assert _args_for(connection, RECENT)[:2] == (GRADE, SECTION)


def test_recent_activity_is_bounded():
    connection = reporting_connection()
    client = build_client(connection)

    client.get("/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS)

    assert _args_for(connection, RECENT)[2] == 8


def test_a_competency_carries_the_databases_own_band():
    client = build_client(reporting_connection())

    data = client.get("/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS).json()["data"]

    # Read from `app.mastery_band_for`, not redrawn with thresholds of the
    # page's own, which had drifted to 75/60 against the database's 80/50.
    assert data["competencies"][0]["average_mastery_band"] == "Developing"


def test_a_small_cohort_hides_the_band_with_the_average():
    small = dict(COMPETENCY_ROW, learners_tracked=2)
    client = build_client(reporting_connection(**{COMPETENCIES: [small]}))

    competency = client.get(
        "/api/v1/teacher-admin/dashboard", headers=ADVISER_HEADERS
    ).json()["data"]["competencies"][0]

    assert competency["suppressed"] is True
    assert competency["average_current_score"] is None
    assert competency["average_mastery_band"] is None
