from langchain_core.callbacks import BaseCallbackHandler


class AgentCallbackHandler(BaseCallbackHandler):
    def __init__(self):
        self.steps: list[str] = []

    def on_tool_start(self, serialized: dict, input_str: str, **kwargs) -> None:
        self.steps.append(f"Using tool: {serialized.get('name')}")

    def on_tool_end(self, output: str, **kwargs) -> None:
        self.steps.append("Tool finished")

    def on_chain_start(self, serialized: dict, inputs: dict, **kwargs) -> None:
        self.steps.append("Thinking...")

    def on_chain_end(self, outputs: dict, **kwargs) -> None:
        self.steps.append("Done")
