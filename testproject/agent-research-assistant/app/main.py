import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agent import create_agent, thread_config
from .prompts import DEEP_RESEARCH_PROMPT, SYSTEM_PROMPT
from .tools import run_document_search

app = FastAPI()

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = create_agent()

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

    full_prompt = f"{SYSTEM_PROMPT}\n\nQuestion: {query_for_agent}"
    response = agent.invoke(
        {"messages": [{"role": "user", "content": full_prompt}]},
        config=thread_config,
    )
    return {"answer": _extract_answer(response)}


# ── Streaming helpers ──────────────────────────────────────────────────────────

_TOOL_LABELS: dict[str, str] = {
    "tavily_search_results_json": "Searching the web",
    "document_search": "Searching your documents",
}


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
def lamp_topics():
    """Return 8 current-event topic suggestions using Tavily web search."""
    from langchain_tavily import TavilySearch  # noqa: PLC0415

    searcher = TavilySearch(max_results=8)
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
        return {"topics": topics[:8]}
    except Exception as exc:  # noqa: BLE001
        return {"topics": [], "error": str(exc)}


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
