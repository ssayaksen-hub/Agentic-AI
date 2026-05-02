import os
import sys
from urllib.error import URLError
from urllib.request import urlopen

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_ollama import ChatOllama
from langchain_tavily import TavilySearch
from langgraph.checkpoint.memory import MemorySaver
from rich.console import Console
from rich.markdown import Markdown

load_dotenv()


def ollama_is_running(base_url: str) -> bool:
	health_url = f"{base_url.rstrip('/')}/api/tags"
	try:
		with urlopen(health_url, timeout=3):
			return True
	except URLError:
		return False


base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
model = os.getenv("OLLAMA_MODEL", "gpt-oss:20b")

if not ollama_is_running(base_url):
	print(f"Could not reach Ollama at {base_url}.")
	print("Start Ollama and pull your model, then try again.")
	print(f"Example: ollama pull {model}")
	sys.exit(1)

llm = ChatOllama(
	model=model,
	base_url=base_url,
)

search_tool = TavilySearch(max_results=5)
tools = [search_tool]

checkpointer = MemorySaver()
agent = create_agent(
	model=llm,
	tools=tools,
	checkpointer=checkpointer,
	system_prompt="Always give a concise and structured answer.",
	debug=True,
)
thread_config = {"configurable": {"thread_id": "default"}}


# Handle both plain-string and block-list message contents.
def render_content(content: object) -> str:
	if isinstance(content, str):
		return content
	if isinstance(content, list):
		parts = []
		for item in content:
			if isinstance(item, dict) and "text" in item:
				parts.append(str(item["text"]))
			else:
				parts.append(str(item))
		return "\n".join(parts)
	return str(content)


console = Console()

while True:
	query = input("\nAsk something: ")
	if query.lower() == "exit":
		break

	response = agent.invoke(
		{"messages": [{"role": "user", "content": query}]},
		config=thread_config,
	)
	answer = render_content(response["messages"][-1].content)
	console.print("\nAnswer:")
	console.print(Markdown(answer))
