from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", enable_decoding=False, env_ignore_empty=True)

    app_env: str = "development"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    rate_limit_per_minute: int = Field(default=60, ge=1, le=10_000)
    max_request_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    upload_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1_024, le=10 * 1024 * 1024)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    llm_base_url: AnyHttpUrl | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    tesseract_cmd: str | None = None
    rule_engine_factory: str | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        return value.split(",") if isinstance(value, str) else value

    @field_validator("cors_origins")
    @classmethod
    def require_explicit_origins(cls, value: list[str]) -> list[str]:
        origins = [origin.rstrip("/") for origin in value]
        if not origins or "*" in origins or any(not origin for origin in origins):
            raise ValueError("CORS_ORIGINS must contain explicit origins")
        return origins

    @property
    def llm_configured(self) -> bool:
        return bool(self.groq_api_key or (self.llm_base_url and self.llm_api_key and self.llm_model))

    @property
    def effective_llm_base_url(self) -> str | None:
        return "https://api.groq.com/openai/v1" if self.groq_api_key else (str(self.llm_base_url) if self.llm_base_url else None)

    @property
    def effective_llm_api_key(self) -> str | None:
        return self.groq_api_key or self.llm_api_key

    @property
    def effective_llm_model(self) -> str | None:
        return self.groq_model if self.groq_api_key else self.llm_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
