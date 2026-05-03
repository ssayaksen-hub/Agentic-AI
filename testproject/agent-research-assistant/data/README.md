# Add your PDF files here

Place any PDF documents you want to embed and retrieve in this folder.

## Example usage:

```python
from app.rag import create_vectorstore

# Embed and store
vectorstore = create_vectorstore("data/sample.pdf", collection_name="my_docs")

# Retrieve similar documents
results = vectorstore.similarity_search("your query", k=3)
```

## Supported formats
- `.pdf` files (via PyPDFLoader)
