from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import create_agent, thread_config
from .prompts import SYSTEM_PROMPT
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


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
