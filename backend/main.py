import warnings

try:
    from langchain_core._api.deprecation import LangChainPendingDeprecationWarning
except ImportError:
    LangChainPendingDeprecationWarning = PendingDeprecationWarning  # type: ignore[misc, assignment]

# Harmless upstream warning when LangGraph loads LangChain's serializer.
warnings.filterwarnings("ignore", category=LangChainPendingDeprecationWarning)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.controllers import (
    auth_controller,
    resume_controller,
    job_controller,
    match_controller,
    interview_controller,
    report_controller,
    ws_controller,
)

app = FastAPI(
    title="Orion ATS API",
    version="1.0.0",
    description="AI-powered ATS and Interview Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_controller.router,      prefix="/auth",       tags=["auth"])
app.include_router(resume_controller.router,    prefix="/resumes",    tags=["resumes"])
app.include_router(job_controller.router,       prefix="/jobs",       tags=["jobs"])
app.include_router(match_controller.router,     prefix="/matches",    tags=["matches"])
app.include_router(interview_controller.router, prefix="/interviews", tags=["interviews"])
app.include_router(report_controller.router,    prefix="/reports",    tags=["reports"])
app.include_router(ws_controller.router,        prefix="/ws",         tags=["websocket"])


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "version": "1.0.0"}
