import json
import os
import random
import re
import time

from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agent import callback_handler, create_agent, thread_config
from .prompts import DEEP_RESEARCH_PROMPT, SYSTEM_PROMPT
from .rag import add_document_to_vectorstore
from .tools import (
    delete_document,
    index_document,
    run_document_search,
    set_latest_uploaded_document,
)

app = FastAPI()

UPLOAD_DIR = "data"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _safe_upload_name(filename: str) -> str:
    # Prevent path traversal and normalize unsupported characters.
    candidate = os.path.basename(filename or "").replace("\x00", "").strip()
    if not candidate:
        return "upload.bin"

    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", candidate).lstrip(".")
    if not cleaned:
        return "upload.bin"
    return cleaned[:255]

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent, _ = create_agent()

DOCUMENT_HINT_KEYWORDS = (
    "pdf",
    "document",
    "doc",
    "file",
    "notes",
    "summarize my",
)


class Query(BaseModel):
    question: str
    mode: str = "normal"  # "normal" | "deep"


def _extract_answer(response: object) -> str:
    if isinstance(response, dict):
        if "output" in response:
            return str(response["output"])
        messages = response.get("messages")
        if isinstance(messages, list) and messages:
            last = messages[-1]
            content = getattr(last, "content", "")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts = []
                for item in content:
                    if isinstance(item, dict) and "text" in item:
                        parts.append(str(item["text"]))
                    else:
                        parts.append(str(item))
                return "\n".join(parts)
            return str(content)
    return str(response)


@app.post("/chat")
def chat(query: Query):
    query_for_agent = query.question
    lower_question = query.question.lower()
    if any(keyword in lower_question for keyword in DOCUMENT_HINT_KEYWORDS):
        doc_context = run_document_search(query.question)
        if not doc_context.startswith("No indexed document") and not doc_context.startswith(
            "No relevant passages"
        ):
            query_for_agent = (
                f"{query.question}\n\n"
                "Relevant context from indexed PDF documents:\n"
                f"{doc_context}\n\n"
                "Answer using the provided document context first."
            )

    base_prompt = DEEP_RESEARCH_PROMPT if query.mode == "deep" else SYSTEM_PROMPT
    full_prompt = f"{base_prompt}\n\nQuestion: {query_for_agent}"
    callback_handler.steps.clear()
    response = agent.invoke(
        {"messages": [{"role": "user", "content": full_prompt}]},
        config={**thread_config, "callbacks": [callback_handler]},
    )
    return {"answer": _extract_answer(response), "steps": list(callback_handler.steps)}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        safe_name = _safe_upload_name(file.filename)
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        
        # Handle filename collisions
        stem, suffix = os.path.splitext(safe_name)
        counter = 1
        while os.path.exists(file_path):
            file_path = os.path.join(UPLOAD_DIR, f"{stem}_{counter}{suffix}")
            counter += 1

        # Write file to disk
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Add document to vector store
        add_document_to_vectorstore(file_path)
        set_latest_uploaded_document(os.path.basename(file_path))
        
        return {
            "message": "File uploaded and indexed successfully",
            "filename": os.path.basename(file_path),
            "stored_filename": os.path.basename(file_path),
            "original_filename": file.filename,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/upload/{filename}")
async def delete_uploaded_file(filename: str):
    safe_name = _safe_upload_name(filename)
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    deleted, detail = delete_document(file_path)
    if not deleted:
        raise HTTPException(status_code=404, detail=detail)

    return {"message": detail, "filename": safe_name}


# ── Streaming helpers ──────────────────────────────────────────────────────────

_TOOL_LABELS: dict[str, str] = {
    "tavily_search_results_json": "Searching the web",
    "document_search": "Searching your documents",
}

_LAMP_TOPICS_CACHE: dict[str, object] = {"topics": [], "ts": 0.0}
_LAMP_TOPICS_TTL_SECONDS = 600
_LAMP_TOPICS_RETURN_COUNT = 5


def _tool_label(name: str) -> str:
    return _TOOL_LABELS.get(name, f"Running {name}")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _message_content_to_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(content)


def _stream_agent(full_prompt: str):
    """Yield SSE strings from a LangGraph agent stream."""
    sent_answer = False
    yield _sse({"type": "step", "text": "Thinking..."})
    try:
        for chunk in agent.stream(
            {"messages": [{"role": "user", "content": full_prompt}]},
            config=thread_config,
            stream_mode="updates",
        ):
            if "agent" in chunk:
                for msg in chunk["agent"].get("messages", []):
                    tool_calls = getattr(msg, "tool_calls", [])
                    if tool_calls:
                        for tc in tool_calls:
                            tc_name = (
                                tc.get("name", "tool")
                                if isinstance(tc, dict)
                                else getattr(tc, "name", "tool")
                            )
                            yield _sse({"type": "step", "text": _tool_label(tc_name)})
                    else:
                        content_text = _message_content_to_text(getattr(msg, "content", ""))
                        if content_text.strip():
                            yield _sse({"type": "answer", "text": content_text})
                            sent_answer = True
            elif "tools" in chunk:
                for msg in chunk["tools"].get("messages", []):
                    tc_name = getattr(msg, "name", "")
                    label = _tool_label(tc_name) if tc_name else "Processing results"
                    yield _sse({"type": "step", "text": f"{label} — done"})

        # Fallback: if the stream completed without final text, run a normal invoke
        # so the UI always receives an answer event.
        if not sent_answer:
            fallback = agent.invoke(
                {"messages": [{"role": "user", "content": full_prompt}]},
                config=thread_config,
            )
            fallback_answer = _extract_answer(fallback)
            if fallback_answer.strip():
                yield _sse({"type": "answer", "text": fallback_answer})
    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "error", "text": str(exc)})
    yield _sse({"type": "done"})


@app.post("/chat/stream")
def chat_stream(query: Query):
    query_for_agent = query.question
    lower_question = query.question.lower()
    if any(keyword in lower_question for keyword in DOCUMENT_HINT_KEYWORDS):
        doc_context = run_document_search(query.question)
        if not doc_context.startswith("No indexed document") and not doc_context.startswith(
            "No relevant passages"
        ):
            query_for_agent = (
                f"{query.question}\n\n"
                "Relevant context from indexed PDF documents:\n"
                f"{doc_context}\n\n"
                "Answer using the provided document context first."
            )

    base_prompt = DEEP_RESEARCH_PROMPT if query.mode == "deep" else SYSTEM_PROMPT
    full_prompt = f"{base_prompt}\n\nQuestion: {query_for_agent}"
    return StreamingResponse(
        _stream_agent(full_prompt),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Lamp topics ───────────────────────────────────────────────────────────────

@app.get("/lamp/topics")
def lamp_topics(response: Response):
    """Return 8 current-event topic suggestions using Tavily web search."""
    from langchain_tavily import TavilySearch  # noqa: PLC0415

    # Avoid intermediary/browser caching so each open can get a fresh randomized subset.
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    now = time.time()
    cached_topics = _LAMP_TOPICS_CACHE.get("topics", [])
    cached_ts = float(_LAMP_TOPICS_CACHE.get("ts", 0.0))
    if isinstance(cached_topics, list) and cached_topics and (now - cached_ts) < _LAMP_TOPICS_TTL_SECONDS:
        topics = [t for t in cached_topics if isinstance(t, str) and t.strip()]
        k = min(_LAMP_TOPICS_RETURN_COUNT, len(topics))
        sampled = random.sample(topics, k=k)
        return {"topics": sampled, "cached": True}

    searcher = TavilySearch(
        max_results=10,
        search_depth="basic",
        include_raw_content=False,
    )
    try:
        results = searcher.invoke("top news stories and trending topics today")
        topics: list[str] = []
        if isinstance(results, list):
            for item in results:
                title = item.get("title", "") if isinstance(item, dict) else ""
                if title and len(title) < 120:
                    topics.append(title.strip())
        elif isinstance(results, dict):
            for item in results.get("results", []):
                title = item.get("title", "")
                if title and len(title) < 120:
                    topics.append(title.strip())
        deduped = list(dict.fromkeys(topics))
        _LAMP_TOPICS_CACHE["topics"] = deduped
        _LAMP_TOPICS_CACHE["ts"] = now
        k = min(_LAMP_TOPICS_RETURN_COUNT, len(deduped))
        sampled = random.sample(deduped, k=k) if k > 0 else []
        return {"topics": sampled, "cached": False}
    except Exception as exc:  # noqa: BLE001
        return {"topics": [], "error": str(exc)}


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
