from pathlib import Path

from langchain_core.tools import tool
from langchain_tavily import TavilySearch

from app.rag import create_vectorstore, load_vectorstore


_retriever = None


def _get_retriever():
    global _retriever
    if _retriever is not None:
        return _retriever

    try:
        vectorstore = load_vectorstore()
        _retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        return _retriever
    except Exception:
        pdf_path = Path("data/sample.pdf")
        if pdf_path.exists():
            vectorstore = create_vectorstore(str(pdf_path))
            _retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
            return _retriever
        return None


def run_document_search(query: str) -> str:
    """Search indexed PDF documents and return relevant excerpts."""
    retriever = _get_retriever()
    if retriever is None:
        return (
            "No indexed document collection is available yet. "
            "Add text-based PDFs to data/ and run: python SETUP_RAG.py"
        )

    docs = retriever.invoke(query)
    if not docs:
        return (
            "No relevant passages were found in the indexed PDFs. "
            "Try a more specific query or re-index your documents."
        )

    return "\n\n".join([doc.page_content for doc in docs])


def index_document(file_path: str) -> tuple[bool, str]:
    """Index a newly uploaded PDF and refresh retriever cache."""
    global _retriever

    path = Path(file_path)
    if not path.exists():
        return False, f"File not found: {file_path}"

    if path.suffix.lower() != ".pdf":
        return False, "Only PDF files are supported for RAG indexing."

    try:
        create_vectorstore(str(path))
        vectorstore = load_vectorstore()
        _retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        return True, "Indexed for RAG"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


@tool("document_search")
def document_search(query: str) -> str:
    """Search through embedded PDF documents and return relevant excerpts."""
    return run_document_search(query)


def get_tools():
    """
    Return list of tools: web search + RAG document retrieval.
    """
    # Web search tool
    search_tool = TavilySearch(
        max_results=3,
        search_depth="basic",
        include_raw_content=False,
    )

    # RAG document retrieval tool
    return [search_tool, document_search]


# For backwards compatibility, expose tools list
tools = []
try:
    tools = get_tools()
except Exception:
    # Fallback to just web search if there's an error
    tools = [
        TavilySearch(
            max_results=3,
            search_depth="basic",
            include_raw_content=False,
        )
    ]

