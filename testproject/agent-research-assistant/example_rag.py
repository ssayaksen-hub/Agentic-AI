"""
Example: Using RAG (Retrieval Augmented Generation) with the agent.

This shows how to load a PDF, embed it, and use it for retrieval.
"""

from app.rag import create_vectorstore, load_vectorstore

# Create a new vector store from PDF
# vectorstore = create_vectorstore(file_path="data/my_document.pdf", collection_name="my_docs")

# Or load an existing vector store from disk
# vectorstore = load_vectorstore(collection_name="my_docs")

# Retrieve similar documents
# results = vectorstore.similarity_search("What is machine learning?", k=3)
# for doc in results:
#     print(f"Source: {doc.metadata['source']}")
#     print(f"Page: {doc.metadata['page']}")
#     print(f"Content: {doc.page_content[:200]}...\n")

print("RAG module ready. See docstrings in app/rag.py for usage.")
