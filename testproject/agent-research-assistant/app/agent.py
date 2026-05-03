from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver

from app.config import llm
from app.prompts import SYSTEM_PROMPT
from app.tools import tools

checkpointer = MemorySaver()

agent = create_agent(
    model=llm,
    tools=tools,
    checkpointer=checkpointer,
    system_prompt=SYSTEM_PROMPT,
)

thread_config = {"configurable": {"thread_id": "default"}}
