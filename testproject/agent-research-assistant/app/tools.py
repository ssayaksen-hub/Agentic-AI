from pathlib import Path

from langchain_tavily import TavilySearch

from app.rag import create_vectorstore, load_vectorstore


def get_tools():
    """
    Return list of tools: web search + RAG document retrieval.
    """
    # Web search tool
    search_tool = TavilySearch(max_results=5)

    # RAG document retrieval tool
    try:
        # Try to load existing vector store
        vectorstore = load_vectorstore()
    except Exception:
        # If no vector store exists yet, try to create from sample PDF
        pdf_path = Path("data/sample.pdf")
        if pdf_path.exists():
            vectorstore = create_vectorstore(str(pdf_path))
        else:
            # No PDF available, return only search tool
            return [search_tool]

    retriever = vectorstore.as_retriever()

    def rag_search(query: str) -> str:
        """Search through embedded PDF documents."""
        docs = retriever.invoke(query)
        if not docs:
            return "No relevant documents found."
        return "\n\n".join([doc.page_content for doc in docs])

    # Add metadata for LangChain
    rag_search.name = "document_search"
    rag_search.description = "Search through embedded PDF documents for relevant information"

    return [search_tool, rag_search]


# For backwards compatibility, expose tools list
tools = []
try:
    tools = get_tools()
except Exception:
    # Fallback to just web search if there's an error
    tools = [TavilySearch(max_results=5)]

