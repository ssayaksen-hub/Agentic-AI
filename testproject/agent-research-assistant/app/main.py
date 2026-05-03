import logging

from langchain_core.globals import set_debug, set_verbose
from rich.console import Console
from rich.markdown import Markdown

from .agent import agent, thread_config
from .tools import run_document_search

set_verbose(False)
set_debug(False)
logging.getLogger("langchain").setLevel(logging.ERROR)
logging.getLogger("langgraph").setLevel(logging.ERROR)

console = Console()

DOCUMENT_HINT_KEYWORDS = (
    "pdf",
    "document",
    "doc",
    "file",
    "notes",
    "summarize my",
)


def render_content(content: object) -> str:
    """Handle both plain-string and block-list message contents."""
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


def main() -> None:
    while True:
        query = input("\nAsk something: ")
        if query.lower() == "exit":
            break

        query_for_agent = query
        if any(keyword in query.lower() for keyword in DOCUMENT_HINT_KEYWORDS):
            doc_context = run_document_search(query)
            if not doc_context.startswith("No indexed document") and not doc_context.startswith(
                "No relevant passages"
            ):
                # Provide retrieved context directly so the model does not ignore the tool.
                query_for_agent = (
                    f"{query}\n\n"
                    "Relevant context from indexed PDF documents:\n"
                    f"{doc_context}\n\n"
                    "Answer using the provided document context first."
                )

        response = agent.invoke(
            {"messages": [{"role": "user", "content": query_for_agent}]},
            config=thread_config,
        )

        # Summarise tool usage from the response messages.
        for msg in response["messages"]:
            tool_calls = getattr(msg, "tool_calls", None)
            if tool_calls:
                for tc in tool_calls:
                    console.print(f"[dim]> Search: {tc['args'].get('query', '')}[/dim]")

        answer = render_content(response["messages"][-1].content)
        console.print("\nAnswer:")
        console.print(Markdown(answer))


if __name__ == "__main__":
    main()
