from __future__ import annotations
from typing import List
from pydantic import Field

try:
    # Pydantic v2 preferred
    from pydantic_settings import BaseSettings
except Exception:  # pragma: no cover - fallback for environments without pydantic-settings
    # Fallback for pydantic v1 environments
    from pydantic import BaseSettings  # type: ignore


class Settings(BaseSettings):
    env: str = Field(default="development")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    tz: str = Field(default="Asia/Ho_Chi_Minh", alias="TZ")

    todoist_token: str | None = Field(default=None, alias="TODOIST_TOKEN")
    slack_webhook_url: str | None = Field(default=None, alias="SLACK_WEBHOOK_URL")

    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()