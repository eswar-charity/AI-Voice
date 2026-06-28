from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List

MIN_JWT_EXPIRE_DAYS = 7


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str  # service role key — bypasses RLS
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    # Prefer JWT_EXPIRE_DAYS in production; JWT_EXPIRE_MINUTES kept for backward compatibility.
    JWT_EXPIRE_DAYS: float = MIN_JWT_EXPIRE_DAYS
    JWT_EXPIRE_MINUTES: int | None = None

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    OPENAI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""

    @field_validator("JWT_EXPIRE_DAYS")
    @classmethod
    def _min_jwt_expire_days(cls, value: float) -> float:
        if value < MIN_JWT_EXPIRE_DAYS:
            return float(MIN_JWT_EXPIRE_DAYS)
        return value

    @property
    def access_token_expire_minutes(self) -> int:
        if self.JWT_EXPIRE_MINUTES is not None:
            return max(self.JWT_EXPIRE_MINUTES, MIN_JWT_EXPIRE_DAYS * 24 * 60)
        return int(self.JWT_EXPIRE_DAYS * 24 * 60)

    @property
    def access_token_expire_seconds(self) -> int:
        return self.access_token_expire_minutes * 60

    class Config:
        env_file = ".env"


settings = Settings()
