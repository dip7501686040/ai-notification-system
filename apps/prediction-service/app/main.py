from fastapi import FastAPI

app = FastAPI(title="prediction-service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "prediction-service"}
