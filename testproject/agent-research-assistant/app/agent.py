from langchain.agents import create_agent as lc_create_agent
from langgraph.checkpoint.memory import MemorySaver

from app.callbacks import AgentCallbackHandler
from app.config import llm
from app.prompts import SYSTEM_PROMPT
from app.tools import get_tools

# Initialize tools (web search + RAG)
tools = get_tools()

checkpointer = MemorySaver()


def create_agent() -> tuple:
    """Return (agent, callback_handler) so callers can inspect step traces."""
    callback_handler = AgentCallbackHandler()
    agent = lc_create_agent(
        model=llm,
        tools=tools,
        checkpointer=checkpointer,
        system_prompt=SYSTEM_PROMPT,
    )
    return agent, callback_handler


agent, callback_handler = create_agent()

thread_config = {"configurable": {"thread_id": "default"}}
