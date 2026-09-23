from types import SimpleNamespace

import pytest

from cli.bootstrap_local import BootstrapRefused, assert_local_target, local_teacher_request


def settings(url: str):
    return SimpleNamespace(
        supabase_url=url,
        supabase_db_url=SimpleNamespace(get_secret_value=lambda: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    )


def teacher_env(**overrides):
    values = {
        "LOCAL_TEACHER_ADMIN_EMAIL": "teacher@example.test",
        "LOCAL_TEACHER_ADMIN_PASSWORD": "not-printed",
        "LOCAL_TEACHER_ADMIN_FULL_NAME": "Local Teacher",
        "LOCAL_TEACHER_ADMIN_EMPLOYEE_ID": "LOCAL-001",
        "LOCAL_TEACHER_ADMIN_SCHOOL_NAME": "Local Elementary School",
        "LOCAL_TEACHER_ADMIN_DIVISION_NAME": "Local Division",
    }
    values.update(overrides)
    return values


def test_refuses_a_non_local_supabase_target():
    with pytest.raises(BootstrapRefused, match="approved local target"):
        assert_local_target(settings("https://example.supabase.co"))


def test_accepts_the_local_supabase_target():
    assert_local_target(settings("http://127.0.0.1:54321/"))


def test_refuses_a_database_url_that_is_not_the_local_stack():
    configured = settings("http://127.0.0.1:54321")
    configured.supabase_db_url = SimpleNamespace(
        get_secret_value=lambda: "postgresql://postgres:password@example.com:5432/postgres"
    )
    with pytest.raises(BootstrapRefused, match="SUPABASE_DB_URL"):
        assert_local_target(configured)


def test_requires_all_teacher_inputs_without_echoing_a_password():
    with pytest.raises(BootstrapRefused) as error:
        local_teacher_request(teacher_env(LOCAL_TEACHER_ADMIN_PASSWORD=""))
    assert "LOCAL_TEACHER_ADMIN_PASSWORD" in str(error.value)
    assert "not-printed" not in str(error.value)
