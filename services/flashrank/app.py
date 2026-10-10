"""Optional CPU FlashRank service; explicitly start it on loopback only."""

from contextlib import asynccontextmanager
import os
from threading import Lock

from fastapi import FastAPI, HTTPException
from flashrank import Ranker, RerankRequest
from pydantic import BaseModel, Field

ranker = None
lock = Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ranker
    # Download occurs only when this separate service is intentionally started.
    ranker = Ranker(
        model_name="ms-marco-TinyBERT-L-2-v2",
        cache_dir=os.getenv("FLASHRANK_CACHE_DIR", ".flashrank-cache"),
        max_length=512,
    )
    yield
    ranker = None


app = FastAPI(lifespan=lifespan)


class Request(BaseModel):
    query: str = Field(min_length=1, max_length=2048)
    documents: list[str] = Field(min_length=1, max_length=50)


@app.post("/rerank")
def rerank(request: Request):
    if not request.query.strip() or any(len(text) > 8192 for text in request.documents):
        raise HTTPException(422, "Query must be nonblank and documents at most 8192 characters")
    if ranker is None:
        raise HTTPException(503, "Model is not ready")
    passages = [{"id": index, "text": text} for index, text in enumerate(request.documents)]
    try:
        # The SDK tokenizer mutates buffers, so serialize inferences.
        with lock:
            ranked = ranker.rerank(RerankRequest(query=request.query, passages=passages))
        return {"results": [{"index": item["id"], "relevance_score": float(item["score"])} for item in ranked]}
    except Exception as error:
        # Do not disclose request text or detailed internals to API clients.
        raise HTTPException(500, "FlashRank inference failed") from error
