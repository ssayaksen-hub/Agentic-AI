import logging

from langchain_core.globals import set_debug, set_verbose
from rich.console import Console
from rich.markdown import Markdown

from agent import agent, thread_config

set_verbose(False)
set_debug(False)
logging.getLogger("langchain").setLevel(logging.ERROR)
logging.getLogger("langgraph").setLevel(logging.ERROR)


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

	# Summarise tool usage from the response messages.
	for msg in response["messages"]:
		tool_calls = getattr(msg, "tool_calls", None)
		if tool_calls:
			for tc in tool_calls:
				console.print(f"[dim]> Search: {tc['args'].get('query', '')}[/dim]")

	answer = render_content(response["messages"][-1].content)
	console.print("\nAnswer:")
	console.print(Markdown(answer))
