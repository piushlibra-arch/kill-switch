import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import init_db, AsyncSessionLocal
from backend.app.seed_data import seed_initial_data
from backend.app.routes import trades, tilt, kill_switch, analytics, baseline, sessions, ws, broker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    await init_db()
    
    # Seed default baseline and restore active broker
    async with AsyncSessionLocal() as db:
        await seed_initial_data(db, settings.DEFAULT_TRADER_ID)
        from backend.app.brokers.manager import broker_manager
        await broker_manager.get_or_restore_adapter(settings.DEFAULT_TRADER_ID, db)
        
    yield
    # Shutdown

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-time Kill Switch Intelligence Layer preventing revenge trading.",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(trades.router)
app.include_router(tilt.router)
app.include_router(kill_switch.router)
app.include_router(analytics.router)
app.include_router(baseline.router)
app.include_router(sessions.router)
app.include_router(ws.router)
app.include_router(broker.router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
