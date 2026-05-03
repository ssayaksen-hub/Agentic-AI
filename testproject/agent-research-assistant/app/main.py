from fastapi import FastAPI
from pydantic import BaseModel

from .agent import create_agent
from .prompts import SYSTEM_PROMPT

app = FastAPI()

agent = create_agent()


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
    full_prompt = f"{SYSTEM_PROMPT}\n\nQuestion: {query.question}"
    response = agent.invoke(full_prompt)
    return {"answer": _extract_answer(response)}


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
