from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    APP_NAME: str = "Kill Switch Intelligence Layer"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite+aiosqlite:///./kill_switch.db"
    SYNC_DATABASE_URL: str = "sqlite:///./kill_switch.db"
    DEFAULT_TRADER_ID: str = "trader_alpha"
    
    # Thresholds
    GREEN_MAX: int = 30
    YELLOW_MAX: int = 60
    ORANGE_MAX: int = 90
    RED_MIN: int = 91  # 90+ considered red / hard lock
    
    # Cooldown defaults
    SOFT_LOCK_WAIT_SECONDS: int = 60
    HARD_LOCK_COOLDOWN_MINUTES: int = 30
    AUTO_RESET_HOURS: int = 4
    AUTO_RESET_THRESHOLD: int = 30
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
