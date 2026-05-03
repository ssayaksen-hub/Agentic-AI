# Agent Research Assistant

A conversational research assistant powered by a local Ollama LLM, Tavily web search, and optional RAG (Retrieval Augmented Generation) for PDF documents.

## Project Structure

```
agent-research-assistant/
│
├── app/
│   ├── __init__.py
│   ├── main.py        # Entry point and REPL loop
│   ├── agent.py       # Agent creation and thread config
│   ├── tools.py       # Tools (Tavily search)
│   ├── config.py      # Env vars, Ollama health check, LLM setup
│   ├── prompts.py     # System prompt
│   └── rag.py         # RAG: PDF loading, embedding, vector store
│
├── .env               # Environment variables (not committed)
├── requirements.txt
├── example_rag.py     # Example usage of RAG module
├── README.md
└── .gitignore
```

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env` and fill in your values:
   ```bash
   cp .env .env.local
   ```

3. Start Ollama and pull your model:
   ```bash
   ollama pull gpt-oss:20b
   ```

## Usage

### Run the agent chat

```bash
python run.py
```

Type your question and press Enter. Type `exit` to quit.

### Use RAG with PDFs

Create a `data/` folder and add PDF files, then use the RAG module:

```python
from app.rag import create_vectorstore

# First time: load and embed PDF
vectorstore = create_vectorstore(file_path="data/my_document.pdf")

# Next time: load from cache
from app.rag import load_vectorstore
vectorstore = load_vectorstore()

# Retrieve similar chunks
results = vectorstore.similarity_search("What is machine learning?", k=3)
```

See `example_rag.py` for full example.

## How It Works

1. **LLM** (Ollama): Local language model for reasoning
2. **Web Search** (Tavily): Real-time web lookup when needed
3. **Vector DB** (Chroma + Ollama embeddings): PDF document retrieval
4. **Memory** (MemorySaver): Conversation context across turns

## Capabilities

- 🤖 Conversational agent with memory
- 🔍 Web search integration
- 📄 PDF document embedding and retrieval (RAG)
- 💾 Local LLM (no API key needed for LLM)
- 📋 Structured answers with markdown formatting
