from pathlib import Path

from langchain_core.tools import tool
from langchain_tavily import TavilySearch

from app.rag import create_vectorstore, load_vectorstore


def get_tools():
    """
    Return list of tools: web search + RAG document retrieval.
    """
    # Web search tool
    search_tool = TavilySearch(max_results=5)

    # RAG document retrieval tool
    retriever = None
    try:
        # Try to load existing vector store
        vectorstore = load_vectorstore()
        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    except Exception:
        # If no vector store exists yet, try to create from sample PDF
        pdf_path = Path("data/sample.pdf")
        if pdf_path.exists():
            vectorstore = create_vectorstore(str(pdf_path))
            retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        else:
            retriever = None

    @tool("document_search")
    def rag_search(query: str) -> str:
        """Search through embedded PDF documents and return relevant excerpts."""
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

    return [search_tool, rag_search]


# For backwards compatibility, expose tools list
tools = []
try:
    tools = get_tools()
except Exception:
    # Fallback to just web search if there's an error
    tools = [TavilySearch(max_results=5)]

