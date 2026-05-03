from pathlib import Path

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from pypdf import PdfReader

from app.config import OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL, VECTOR_COLLECTION_NAME


def _extract_documents_with_fallback(file_path: str) -> list[Document]:
    """Load PDF text with PyPDFLoader, then fallback to pypdf if needed."""
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    has_text = any((doc.page_content or "").strip() for doc in documents)
    if has_text:
        return documents

    # Some PDFs are readable by pypdf but return empty content via loader defaults.
    reader = PdfReader(file_path)
    fallback_docs: list[Document] = []
    for page_idx, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        fallback_docs.append(
            Document(
                page_content=text,
                metadata={"source": file_path, "page": page_idx},
            )
        )

    return fallback_docs


def create_vectorstore(
    file_path: str = "data/sample.pdf",
    collection_name: str = VECTOR_COLLECTION_NAME,
):
    """
    Load PDF, split into chunks, embed with Ollama, and store in Chroma.
    
    Args:
        file_path: Path to PDF file
        collection_name: Chroma collection name for organization
        
    Returns:
        Chroma vector store instance
    """
    # Validate file exists
    pdf_path = Path(file_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    # Load PDF with fallback extraction for loader-incompatible files.
    documents = _extract_documents_with_fallback(file_path)

    # Split into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    docs = text_splitter.split_documents(documents)

    # Filter out empty chunks so Chroma does not receive empty embeddings.
    docs = [doc for doc in docs if doc.page_content and doc.page_content.strip()]
    if not docs:
        raise ValueError(
            "No non-empty text extracted from the PDF. "
            "Check that the PDF contains selectable text (not scanned images). "
            "If this is a scanned PDF, run OCR first and then retry."
        )

    # Create embeddings using local Ollama
    embeddings = OllamaEmbeddings(
        model=OLLAMA_EMBED_MODEL,
        base_url=OLLAMA_BASE_URL,
    )

    # Preflight embedding call so model/config errors are reported clearly.
    sample_embedding = embeddings.embed_query("embedding health check")
    if not sample_embedding:
        raise ValueError(
            f"Embedding model '{OLLAMA_EMBED_MODEL}' returned an empty vector. "
            "Make sure the model exists locally (e.g. `ollama pull nomic-embed-text`)."
        )

    # Store in Chroma vector database
    vectorstore = Chroma.from_documents(
        docs,
        embeddings,
        collection_name=collection_name,
        persist_directory="./chroma_db"
    )

    return vectorstore


def load_vectorstore(collection_name: str = VECTOR_COLLECTION_NAME):
    """
    Load an existing Chroma vector store from disk.
    
    Args:
        collection_name: Chroma collection name
        
    Returns:
        Chroma vector store instance
    """
    embeddings = OllamaEmbeddings(
        model=OLLAMA_EMBED_MODEL,
        base_url=OLLAMA_BASE_URL,
    )

    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory="./chroma_db"
    )

    return vectorstore
