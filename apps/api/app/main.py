from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, businesses, chat, feed, leads, mentions

app = FastAPI(title="QuietEyes API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(businesses.router)
app.include_router(feed.router)
app.include_router(leads.router)
app.include_router(chat.router)
app.include_router(mentions.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "quieteyes-api"}
