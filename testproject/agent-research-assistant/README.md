# Agent Research Assistant

A conversational research assistant powered by a local Ollama LLM and Tavily web search.

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
│   └── prompts.py     # System prompt
│
├── .env               # Environment variables (not committed)
├── requirements.txt
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

Run from the project root:

```bash
python -m app.main
```

Type your question and press Enter. Type `exit` to quit.
