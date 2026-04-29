from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")

response = llm.invoke("Explain what an AI agent is in simple terms")
print(response.content)
