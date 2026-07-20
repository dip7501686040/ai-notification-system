from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.grpc_health import start_grpc_health_server


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    grpc_server = await start_grpc_health_server()
    yield
    await grpc_server.stop(grace=1)


app = FastAPI(title="prediction-service", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "prediction-service"}
