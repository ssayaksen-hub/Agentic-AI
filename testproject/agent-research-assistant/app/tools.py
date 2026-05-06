from pathlib import Path

from langchain_core.tools import tool
from langchain_tavily import TavilySearch

from app.rag import create_vectorstore, load_vectorstore, rebuild_vectorstore


_retriever = None
_latest_uploaded_filename: str | None = None


def set_latest_uploaded_document(filename: str) -> None:
    """Set the most recently uploaded stored filename for search preference."""
    global _latest_uploaded_filename
    _latest_uploaded_filename = filename


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
    """Search indexed documents and return relevant excerpts."""
    retriever = _get_retriever()
    if retriever is None:
        return (
            "No indexed document collection is available yet. "
            "Add text-based PDFs to data/ and run: python SETUP_RAG.py"
        )

    docs = []
    if _latest_uploaded_filename:
        try:
            vectorstore = load_vectorstore()
            latest_source = str(Path("data") / _latest_uploaded_filename)
            docs = vectorstore.similarity_search(
                query,
                k=6,
                filter={"source": latest_source},
            )
        except Exception:
            docs = []

    if not docs:
        docs = retriever.invoke(query)

    if not docs:
        return (
            "No relevant passages were found in the indexed PDFs. "
            "Try a more specific query or re-index your documents."
        )

    return "\n\n".join([doc.page_content for doc in docs])


def index_document(file_path: str) -> tuple[bool, str]:
    """Index a newly uploaded document and refresh retriever cache."""
    global _retriever

    path = Path(file_path)
    if not path.exists():
        return False, f"File not found: {file_path}"

    try:
        vectorstore = rebuild_vectorstore(str(path.parent))
        _retriever = (
            vectorstore.as_retriever(search_kwargs={"k": 4})
            if vectorstore is not None
            else None
        )
        return True, "Indexed for RAG"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def delete_document(file_path: str) -> tuple[bool, str]:
    """Delete an uploaded document and rebuild the retriever state."""
    global _latest_uploaded_filename, _retriever

    path = Path(file_path)
    if not path.exists():
        return False, f"File not found: {file_path}"

    try:
        path.unlink()
        if _latest_uploaded_filename == path.name:
            _latest_uploaded_filename = None
        vectorstore = rebuild_vectorstore(str(path.parent))
        _retriever = (
            vectorstore.as_retriever(search_kwargs={"k": 4})
            if vectorstore is not None
            else None
        )
        return True, "Document deleted"
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

