import os
import sys
from urllib.error import URLError
from urllib.request import urlopen

from dotenv import load_dotenv
from langchain_ollama import ChatOllama

load_dotenv()


def ollama_is_running(base_url: str) -> bool:
	health_url = f"{base_url.rstrip('/')}/api/tags"
	try:
		with urlopen(health_url, timeout=3):
			return True
	except URLError:
		return False


base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
model = os.getenv("OLLAMA_MODEL", "llama3.2")

if not ollama_is_running(base_url):
	print(f"Could not reach Ollama at {base_url}.")
	print("Start Ollama and pull your model, then try again.")
	print(f"Example: ollama pull {model}")
	sys.exit(1)

llm = ChatOllama(
	model=model,
	base_url=base_url,
)

response = llm.invoke("Explain what an AI agent is in simple terms")
print(response.content)
