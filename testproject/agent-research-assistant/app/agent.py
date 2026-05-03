from langchain.agents import create_agent as lc_create_agent
from langgraph.checkpoint.memory import MemorySaver

from app.config import llm
from app.prompts import SYSTEM_PROMPT
from app.tools import get_tools

# Initialize tools (web search + RAG)
tools = get_tools()

checkpointer = MemorySaver()

def create_agent():
    return lc_create_agent(
        model=llm,
        tools=tools,
        checkpointer=checkpointer,
        system_prompt=SYSTEM_PROMPT,
    )


agent = create_agent()

thread_config = {"configurable": {"thread_id": "default"}}
