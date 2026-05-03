"""
RAG Setup Guide

This shows how to embed your PDF documents so the agent can retrieve from them.
"""

# Step 1: Create your data folder (already done if you ran mkdir data)
# Place any PDF files in: agent-research-assistant/data/

# Step 2: Embed your PDFs (one-time setup)
# Run this once to embed and store your documents:

from app.rag import create_vectorstore

# Example: embed a single PDF
vectorstore = create_vectorstore(
    file_path="data/sample.pdf",
    collection_name="my_documents"
)
print("✓ PDF embedded and stored in ./chroma_db")

# Step 3: Now run the agent
# python run.py

# Step 4: Ask questions about your documents
# Example questions:
# - "What is mentioned in the document about X?"
# - "Summarize the key points from my PDF"
# - "Find information about Y in my documents"

# The agent will automatically choose between:
# 1. Web search (for current info)
# 2. Document search (for your PDFs)
# 3. Direct reasoning (for general knowledge)

print("\n✓ Setup complete! Run: python run.py")
