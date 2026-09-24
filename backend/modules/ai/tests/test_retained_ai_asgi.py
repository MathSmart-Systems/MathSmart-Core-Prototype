"""Async-ASGI verification for the three retained advisory flows.

Starlette's synchronous ``TestClient`` is a known local baseline hang.  These
tests exercise the same FastAPI routes and dependencies through httpx's ASGI
transport instead, with a mock adviser and no external Gemini request.
"""

from datetime import UTC, datetime
from uuid import UUID

import httpx
import pytest
from pydantic import SecretStr

from app.main import create_app
from modules.interventions.tests.test_interventions import (
    ROW,
    WRITTEN_ROW,
    intervention_connection,
)
from modules.shared.gemini_adapter import AdvisoryResult
from modules.shared.testing import (
    ADVISER_HEADERS,
    LEARNER_HEADERS,
    FakeConnection,
    FakeDatabase,
    FakeSessionGateway,
    FakeVerifier,
    fake_settings,
)

COMPETENCY = UUID("13ec5f06-746e-45fb-a58a-92f4ce42621c")
INTERVENTION_ID = "f87d7703-ef37-4bfa-943f-c2bc7e69cb01"
ATTACH = "app.attach_intervention_advice"
CLEAR = "app.clear_intervention_advice"

TEACHING_NOTE = (
    '{"gap": "The learner adds denominators when multiplying fractions.", '
    '"evidence": ["Current score is 40%."], '
    '"actions": ["Model one product on an area grid."], '
    '"next_check": "Ask for one product without the grid."}'
)
SUPPORT_PLAN = (
    '{"gap": "The learner loses the decimal point.", '
    '"strategies": ["Use a number line first."], '
    '"scaffold": "Draw a place-value chart.", '
    '"next_check": "Check two similar problems."}'
)


class MockGemini:
    """A server-side adviser with observable, bounded evidence."""

    def __init__(self, *, answers: dict[str, str | None], enabled: bool = True) -> None:
        self.answers = answers
        self.enabled = enabled
        self.calls: list[dict[str, object]] = []

    async def advise(self, *, purpose: str, evidence: dict, **shape):
        self.calls.append({"purpose": purpose, "evidence": evidence, **shape})
        text = self.answers.get(purpose)
        if text is None:
            return None
        return AdvisoryResult(
            text=text,
            provider="gemini",
            model="test-model",
            generated_at=datetime.now(UTC),
        )


def app_for(connection, ai: MockGemini, *, server_enabled: bool = True):
    settings = fake_settings()
    settings.gemini_enabled = server_enabled
    if server_enabled:
        settings.gemini_model = "test-model"
        settings.gemini_api_key = SecretStr("gsk_test")
    connection.results.setdefault("app.gemini_advisory_enabled()", True)
    return create_app(
        settings=settings,
        token_verifier=FakeVerifier(),
        database=FakeDatabase(connection),
        session_gateway=FakeSessionGateway(),
        ai=ai,
    )


def client_for(application):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application), base_url="http://mathsmart.test"
    )


@pytest.mark.asyncio
async def test_retained_ai_routes_are_teacher_only_and_keep_credentials_server_side():
    ai = MockGemini(
        answers={"teacher insight": TEACHING_NOTE, "pattern analysis": "Review sign rules."}
    )
    application = app_for(FakeConnection(), ai)

    async with client_for(application) as client:
        learner = await client.post(
            "/api/v1/ai/teacher-insight",
            json={"competency_id": str(COMPETENCY), "current_score": 40},
            headers=LEARNER_HEADERS,
        )
        insight = await client.post(
            "/api/v1/ai/teacher-insight",
            json={"competency_id": str(COMPETENCY), "current_score": 40},
            headers=ADVISER_HEADERS,
        )
        patterns = await client.post(
            "/api/v1/ai/pattern-analysis",
            json={"competency_id": str(COMPETENCY), "incorrect_attempts": []},
            headers=ADVISER_HEADERS,
        )

    assert learner.status_code == 403
    assert insight.status_code == 200
    assert patterns.status_code == 200
    assert len(ai.calls) == 2
    assert "test-model" not in insight.text
    assert "gsk_test" not in insight.text
    assert patterns.json()["data"]["provider"] == "gemini"


@pytest.mark.asyncio
async def test_case_suggestion_is_persisted_then_removed_only_for_a_teacher():
    connection = intervention_connection(
        **{ATTACH: WRITTEN_ROW, CLEAR: WRITTEN_ROW}
    )
    ai = MockGemini(answers={"intervention support plan": SUPPORT_PLAN})
    application = app_for(connection, ai)

    async with client_for(application) as client:
        created = await client.post(
            f"/api/v1/interventions/{INTERVENTION_ID}/ai-suggestion",
            headers=ADVISER_HEADERS,
        )
        dismissed = await client.delete(
            f"/api/v1/interventions/{INTERVENTION_ID}/ai-suggestion",
            headers=ADVISER_HEADERS,
        )

    statements = [statement for statement, _args in connection.calls]
    assert created.status_code == 200
    assert dismissed.status_code == 200
    assert any(ATTACH in statement for statement in statements)
    assert any(CLEAR in statement for statement in statements)
    evidence = ai.calls[0]["evidence"]
    assert ROW["full_name"] not in repr(evidence)
    assert ROW["learner_id"] not in repr(evidence)


@pytest.mark.asyncio
async def test_disabled_advice_leaves_the_intervention_unchanged():
    connection = intervention_connection(**{ATTACH: WRITTEN_ROW})
    application = app_for(
        connection,
        MockGemini(answers={"intervention support plan": SUPPORT_PLAN}, enabled=False),
        server_enabled=False,
    )

    async with client_for(application) as client:
        response = await client.post(
            f"/api/v1/interventions/{INTERVENTION_ID}/ai-suggestion",
            headers=ADVISER_HEADERS,
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "gemini_assistance_unavailable"
    assert not [statement for statement, _args in connection.calls if ATTACH in statement]
