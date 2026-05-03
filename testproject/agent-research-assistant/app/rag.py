from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL


def create_vectorstore(file_path: str = "data/sample.pdf", collection_name: str = "documents"):
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

    # Load PDF
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    # Split into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    docs = text_splitter.split_documents(documents)

    # Create embeddings using local Ollama
    embeddings = OllamaEmbeddings(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
    )

    # Store in Chroma vector database
    vectorstore = Chroma.from_documents(
        docs,
        embeddings,
        collection_name=collection_name,
        persist_directory="./chroma_db"
    )

    return vectorstore


def load_vectorstore(collection_name: str = "documents"):
    """
    Load an existing Chroma vector store from disk.
    
    Args:
        collection_name: Chroma collection name
        
    Returns:
        Chroma vector store instance
    """
    embeddings = OllamaEmbeddings(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
    )

    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory="./chroma_db"
    )

    return vectorstore
