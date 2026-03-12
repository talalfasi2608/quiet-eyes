from fastapi import FastAPI

app = FastAPI(title="QuietEyes API", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "quieteyes-api"}
