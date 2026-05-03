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
│   ├── tools.py       # Tools: web search + document search (RAG)
│   ├── config.py      # Env vars, Ollama health check, LLM setup
│   ├── prompts.py     # System prompt with tool descriptions
│   └── rag.py         # RAG: PDF loading, embedding, vector store
│
├── data/              # Your PDF files go here
├── .env               # Environment variables (not committed)
├── requirements.txt
├── SETUP_RAG.py       # One-time script to embed PDFs
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

The agent automatically chooses between:
- **Web Search** — For current/online information
- **Document Search** — For your embedded PDFs
- **Direct Reasoning** — For general knowledge

### Embed your PDFs (one-time setup)

1. Place PDF files in the `data/` folder
2. Run the setup script:
   ```bash
   python SETUP_RAG.py
   ```
3. This embeds all PDFs and stores them in `./chroma_db` (one-time operation)
4. Now run the agent and ask questions about your documents:
   ```bash
   python run.py
   ```

### Example questions

Once PDFs are embedded, you can ask:
- "What are the main topics in my documents?"
- "Find information about machine learning"
- "Summarize the key points"

The agent will use document search automatically when relevant.

### Advanced: Use RAG standalone

```python
from app.rag import load_vectorstore

vectorstore = load_vectorstore()
results = vectorstore.similarity_search("your query", k=3)
for doc in results:
    print(doc.page_content)
```

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
