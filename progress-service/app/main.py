from __future__ import annotations

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from .models import ProgressInput, ProgressOutput
from .services import compute_progress
from .settings import settings
from .logging_config import logger

app = FastAPI(title="Progress Service", version="0.1.0")

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if not origins:
    origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics at /metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/progress/compute", response_model=ProgressOutput)
def progress_compute(payload: ProgressInput):
    try:
        result = compute_progress(payload)
        return result
    except Exception as e:
        logger.exception("Failed to compute progress")
        raise HTTPException(status_code=400, detail=str(e))
