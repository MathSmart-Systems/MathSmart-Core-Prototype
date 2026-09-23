"""Create or reuse the configured local Teacher/Administrator identity.

This command is deliberately unavailable as an HTTP endpoint. It first proves
every configured target is the local Supabase stack, then creates the trusted
Auth identity only when absent and attaches the audited application profile.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from urllib.parse import urlsplit

from app.config import Settings, get_settings
from cli.bootstrap_profile import BootstrapRefused, bootstrap
from modules.shared.auth_admin import AuthAdminError, SupabaseAuthAdmin
from modules.shared.elevated_db import ElevatedDatabase

logger = logging.getLogger("mathsmart.local_bootstrap")

_LOCAL_SUPABASE_URLS = {
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
}
_LOCAL_DATABASE_HOSTS = {"127.0.0.1", "localhost", "::1"}
_LOCAL_DATABASE_PORT = 54322

_REQUIRED = (
    "LOCAL_TEACHER_ADMIN_EMAIL",
    "LOCAL_TEACHER_ADMIN_PASSWORD",
    "LOCAL_TEACHER_ADMIN_FULL_NAME",
    "LOCAL_TEACHER_ADMIN_EMPLOYEE_ID",
    "LOCAL_TEACHER_ADMIN_SCHOOL_NAME",
    "LOCAL_TEACHER_ADMIN_DIVISION_NAME",
)


def _local_url(value: str) -> str:
    return value.rstrip("/")


def assert_local_target(settings: Settings) -> None:
    """Refuse before constructing an Auth client or opening PostgreSQL."""
    if _local_url(settings.supabase_url) not in _LOCAL_SUPABASE_URLS:
        raise BootstrapRefused(
            "Refusing local bootstrap: SUPABASE_URL is not an approved local target."
        )
    database = urlsplit(settings.supabase_db_url.get_secret_value())
    if (
        database.scheme not in {"postgres", "postgresql"}
        or database.hostname not in _LOCAL_DATABASE_HOSTS
        or database.port != _LOCAL_DATABASE_PORT
    ):
        raise BootstrapRefused(
            "Refusing local bootstrap: SUPABASE_DB_URL is not an approved local target."
        )


def local_teacher_request(env: dict[str, str]) -> dict[str, str]:
    missing = [name for name in _REQUIRED if not env.get(name, "").strip()]
    if missing:
        raise BootstrapRefused("Local bootstrap requires: " + ", ".join(missing))
    return {
        "role": "teacher_admin",
        "email": env["LOCAL_TEACHER_ADMIN_EMAIL"].strip(),
        "password": env["LOCAL_TEACHER_ADMIN_PASSWORD"],
        "full_name": env["LOCAL_TEACHER_ADMIN_FULL_NAME"].strip(),
        "employee_id": env["LOCAL_TEACHER_ADMIN_EMPLOYEE_ID"].strip(),
        "school_name": env["LOCAL_TEACHER_ADMIN_SCHOOL_NAME"].strip(),
        "division_name": env["LOCAL_TEACHER_ADMIN_DIVISION_NAME"].strip(),
    }


async def run(settings: Settings, env: dict[str, str]) -> bool:
    assert_local_target(settings)
    request = local_teacher_request(env)
    auth = SupabaseAuthAdmin(settings)
    existing = await auth.find_user_by_email(request["email"])
    created_auth = existing is None
    if existing is None:
        user = await auth.create_user(
            email=request["email"],
            password=request["password"],
            app_metadata={"role": "teacher_admin"},
        )
    else:
        user = existing
        if user.app_metadata.get("role") != "teacher_admin":
            raise BootstrapRefused(
                "The configured local account does not carry the teacher_admin role."
            )

    database = ElevatedDatabase(settings.supabase_db_url)
    await database.connect()
    try:
        result = await bootstrap(
            auth_admin=auth,
            elevated=database,
            request={key: value for key, value in request.items() if key != "password"},
        )
    except Exception:
        if created_auth:
            await auth.delete_user(user.id)
        raise
    finally:
        await database.disconnect()
    return result.created or created_auth


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        created = asyncio.run(run(get_settings(), dict(os.environ)))
    except (AuthAdminError, BootstrapRefused) as error:
        logger.error("%s", error)
        return 1
    logger.info(
        "Local Teacher/Administrator bootstrap %s.",
        "created" if created else "already present",
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
