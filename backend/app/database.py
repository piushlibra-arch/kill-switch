from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def _run_migrations(connection):
    inspector = inspect(connection)
    tables = inspector.get_table_names()
    if "broker_configs" in tables:
        columns = [col["name"] for col in inspector.get_columns("broker_configs")]
        if "currency_code" not in columns:
            connection.execute(text("ALTER TABLE broker_configs ADD COLUMN currency_code VARCHAR(16) DEFAULT 'INR' NOT NULL"))
        if "currency_symbol" not in columns:
            connection.execute(text("ALTER TABLE broker_configs ADD COLUMN currency_symbol VARCHAR(16) DEFAULT '₹' NOT NULL"))
        if "locale" not in columns:
            connection.execute(text("ALTER TABLE broker_configs ADD COLUMN locale VARCHAR(16) DEFAULT 'en-IN' NOT NULL"))

async def init_db():
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        # Run any column migrations for SQLite
        await conn.run_sync(_run_migrations)
