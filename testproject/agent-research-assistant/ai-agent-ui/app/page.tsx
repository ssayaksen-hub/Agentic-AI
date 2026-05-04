"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "ai";
  content: string;
};

type Chat = {
  id: number;
  messages: Message[];
};

// ── Inline markdown renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-[#f0ebe0] px-1 py-0.5 font-mono text-sm">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function MarkdownBody({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`pre-${i}`} className="my-3 overflow-x-auto rounded-lg bg-[#f0ebe0] p-4 font-mono text-sm">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(<h3 key={`h-${i}`} className="mb-1 mt-4 text-base font-semibold">{renderInline(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={`h-${i}`} className="mb-1 mt-4 text-lg font-semibold">{renderInline(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={`h-${i}`} className="mb-1 mt-4 text-xl font-bold">{renderInline(line.slice(2))}</h1>);
      i++; continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-[#e4ddce]" />);
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[-*+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].replace(/^[-*+] /, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 list-disc space-y-1 pl-5">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ol>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={`bq-${i}`} className="my-2 border-l-[3px] border-[#d7cdb8] pl-3 italic text-slate-500">
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      i++; continue;
    }

    // Blank line
    if (line.trim() === "") { i++; continue; }

    // Paragraph — accumulate consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^[-*+] /) &&
      !lines[i].match(/^\d+\. /) &&
      !lines[i].startsWith("> ") &&
      !lines[i].match(/^[-*_]{3,}$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={`p-${i}`} className="my-2 first:mt-0 last:mb-0">{renderInline(paraLines.join(" "))}</p>,
      );
    }
  }

  return <div className="text-[15px] leading-7">{elements}</div>;
}

// ── Floating thinking cloud ──────────────────────────────────────────────────

function ThinkingCloud({ steps }: { steps: string[] }) {
  return (
    <div className="mr-auto flex max-w-sm flex-col gap-2">
      {/* Cloud */}
      <div className="cloud-float relative h-16 w-28">
        <div className="absolute inset-x-0 bottom-0 h-8 rounded-full bg-[#e4dbc8]" />
        <div className="absolute bottom-3 left-1 h-12 w-12 rounded-full bg-[#e4dbc8]" />
        <div className="absolute bottom-3 right-1 h-9 w-9 rounded-full bg-[#e4dbc8]" />
        <div className="absolute bottom-4 left-1/2 h-13 w-13 -translate-x-1/2 rounded-full bg-[#e4dbc8]" />
        {/* Thinking dots */}
        <div className="absolute bottom-[0.6rem] left-1/2 flex -translate-x-1/2 gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#9a8060]"
              style={{ animation: `bounce 1.1s ease-in-out ${dot * 0.18}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* Steps feed */}
      {steps.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-1">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs italic text-slate-400">
              <span className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-[#c4b89a]" />
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([{ id: 0, messages: [] }]);
  const [currentChatIndex, setCurrentChatIndex] = useState<number | null>(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);

  const messages = useMemo(
    () => (currentChatIndex === null ? [] : (chats[currentChatIndex]?.messages ?? [])),
    [chats, currentChatIndex],
  );
  const hasStarted = chats.some((chat) => chat.messages.length > 0);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, steps]);

  const createNewChat = () => {
    const newChat: Chat = { id: Date.now(), messages: [] };
    setChats((prev) => [...prev, newChat]);
    setCurrentChatIndex(chats.length);
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || currentChatIndex === null) return;

    const updatedChats = [...chats];
    const chat = updatedChats[currentChatIndex];
    chat.messages.push({ role: "user", content: question });
    setChats(updatedChats);
    setInput("");
    setLoading(true);
    setSteps([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const errText = await res.text();
        chat.messages.push({
          role: "ai",
          content: `Request failed (${res.status}): ${errText || "Unable to reach streaming endpoint."}`,
        });
        setChats([...updatedChats]);
        setLoading(false);
        setSteps([]);
        return;
      }

      if (!res.body) {
        chat.messages.push({
          role: "ai",
          content: "No stream body received from server.",
        });
        setChats([...updatedChats]);
        setLoading(false);
        setSteps([]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answerReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines.
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6)) as { type: string; text?: string };
            if (event.type === "step" && event.text) {
              const stepText = event.text;
              setSteps((prev) => [...prev, stepText]);
            } else if (event.type === "answer" && event.text) {
              chat.messages.push({ role: "ai", content: event.text });
              setChats([...updatedChats]);
              answerReceived = true;
            } else if (event.type === "error") {
              chat.messages.push({ role: "ai", content: `Error: ${event.text ?? "unknown"}` });
              setChats([...updatedChats]);
              answerReceived = true;
            }
          } catch {
            // malformed SSE event chunk — ignore
          }
        }
      }

      if (!answerReceived) {
        chat.messages.push({
          role: "ai",
          content: "I could not produce an answer from the stream. Please retry after restarting the backend server.",
        });
        setChats([...updatedChats]);
      }
    } catch (error) {
      chat.messages.push({
        role: "ai",
        content: `Network error: ${error instanceof Error ? error.message : "unknown error"}`,
      });
      setChats([...updatedChats]);
    } finally {
      setLoading(false);
      setSteps([]);
    }
  };

  return (
    <div className="flex h-screen bg-[#f7f3eb] text-slate-800">
      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-[#e6dfd2] bg-[#efe8da] p-4 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hasStarted ? "w-56 opacity-100" : "w-0 overflow-hidden opacity-0 p-0"
        }`}
      >
        <button
          onClick={createNewChat}
          className="mb-4 whitespace-nowrap rounded-xl border border-[#d7cdb8] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#f8f4ea]"
        >
          + New Chat
        </button>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {chats.map((chat, index) => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatIndex(index)}
              className={`cursor-pointer whitespace-nowrap rounded-lg p-2 text-sm transition ${
                index === currentChatIndex
                  ? "border border-[#d7cdb8] bg-white text-slate-900"
                  : "text-slate-600 hover:bg-[#f7f0e2]"
              }`}
            >
              Chat {index + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Genie title */}
        <div
          className={`font-genie absolute left-1/2 -translate-x-1/2 text-center leading-none tracking-wide text-slate-700 transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hasStarted ? "top-4 text-5xl" : "top-1/2 -translate-y-24 text-8xl"
          }`}
        >
          Genie
        </div>

        {/* Messages */}
        {hasStarted ? (
          <div className="h-full w-full space-y-4 overflow-y-auto bg-[#f9f6ef] px-6 pt-28 pb-44">
            {currentChatIndex !== null &&
              chats[currentChatIndex].messages.map((msg: Message, i: number) => (
                <div
                  key={i}
                  className={`max-w-2xl rounded-2xl px-5 py-3 shadow-sm ${
                    msg.role === "user"
                      ? "ml-auto border border-[#ddd3be] bg-[#efe6d4] text-slate-900"
                      : "mr-auto border border-[#e4ddce] bg-white text-slate-800"
                  }`}
                >
                  {msg.role === "ai" ? <MarkdownBody content={msg.content} /> : msg.content}
                </div>
              ))}

            {loading && <ThinkingCloud steps={steps} />}
            <div ref={bottomRef} />
          </div>
        ) : null}

        {/* Composer */}
        <div
          className={`absolute left-1/2 w-full -translate-x-1/2 px-6 transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hasStarted ? "bottom-7" : "top-1/2 translate-y-6"
          }`}
        >
          <div className="mx-auto flex w-full max-w-5xl items-end gap-3 rounded-2xl border border-[#d6ccb8] bg-white px-3 py-3 shadow-sm">
            <textarea
              className="min-h-[64px] flex-1 resize-y rounded-xl px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the void..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={loading}
              className="rounded-xl bg-[#d9c29d] px-5 py-2.5 font-medium text-slate-900 transition hover:bg-[#ccb089] disabled:cursor-not-allowed disabled:bg-[#d8cfbf]"
            >
              Probe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


