from langchain.tools import Tool
from langchain_community.tools.tavily_search import TavilySearchResults

from pathlib import Path

from app.rag import load_vectorstore


# Track latest uploaded file for potential future use
_latest_uploaded_filename: str | None = None


def set_latest_uploaded_document(filename: str) -> None:
    """Track the most recently uploaded document."""
    global _latest_uploaded_filename
    _latest_uploaded_filename = filename


def delete_document(file_path: str) -> tuple[bool, str]:
    """Delete an uploaded document from disk."""
    global _latest_uploaded_filename
    
    path = Path(file_path)
    if not path.exists():
        return False, f"File not found: {file_path}"

    try:
        path.unlink()
        if _latest_uploaded_filename == path.name:
            _latest_uploaded_filename = None
        return True, "Document deleted"
    except Exception as exc:
        return False, str(exc)


def get_tools():
    search_tool = TavilySearchResults()

    def rag_search(query: str):
        vectorstore = load_vectorstore()

        docs = vectorstore.similarity_search(query, k=4)

        if not docs:
            return "No relevant information found."

        return "\n\n".join([
            doc.page_content for doc in docs
        ])

    rag_tool = Tool(
        name="Document Search",
        func=rag_search,
        description="Search uploaded documents for relevant information"
    )

    return [search_tool, rag_tool]


# For backwards compatibility
tools = []
try:
    tools = get_tools()
except Exception:
    tools = [TavilySearchResults()]
