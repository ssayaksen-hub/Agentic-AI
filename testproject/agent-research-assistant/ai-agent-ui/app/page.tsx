"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Message = {
  role: "user" | "ai";
  content: string;
};

type Chat = {
  id: number;
  messages: Message[];
};

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([{ id: 0, messages: [] }]);
  const [currentChatIndex, setCurrentChatIndex] = useState<number | null>(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messages = useMemo(
    () => (currentChatIndex === null ? [] : (chats[currentChatIndex]?.messages ?? [])),
    [chats, currentChatIndex],
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now(),
      messages: [],
    };

    setChats((prev) => [...prev, newChat]);
    setCurrentChatIndex(chats.length);
  };

  const appendMessage = (message: Message) => {
    setChats((prev) => {
      const next = [...prev];
      const activeIndex = currentChatIndex ?? 0;

      if (!next[activeIndex]) {
        next[activeIndex] = { id: Date.now(), messages: [] };
      }

      next[activeIndex] = {
        ...next[activeIndex],
        messages: [...next[activeIndex].messages, message],
      };
      return next;
    });

    if (currentChatIndex === null) {
      setCurrentChatIndex(0);
    }
  };

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: Message = { role: "user", content: question };
    appendMessage(userMessage);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error("Backend request failed");
      }

      const data = await res.json();
      const aiMessage: Message = {
        role: "ai",
        content: typeof data.answer === "string" ? data.answer : "No answer received.",
      };
      appendMessage(aiMessage);
    } catch {
      appendMessage({
        role: "ai",
        content: "I could not reach the backend. Make sure FastAPI is running on 127.0.0.1:8000.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-900">
      <div className="mx-auto flex h-screen w-full max-w-4xl flex-col px-3 py-4 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assistant</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-900">AI Research Assistant</h1>
            <button
              onClick={createNewChat}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              New chat
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">Summarize indexed PDFs or ask a research question.</p>
        </header>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-6">
            Try: &quot;Summarize my PDF document&quot; or ask a research question.
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Your conversation will appear here.
              </div>
            ) : null}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  msg.role === "user"
                    ? "ml-auto bg-[#ececf1] text-slate-900"
                    : "mr-auto border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {msg.role === "user" ? "You" : "Assistant"}
                </p>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {loading ? <div className="text-sm text-slate-500">Assistant is thinking...</div> : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-300 bg-white p-2 shadow-sm">
              <div className="flex items-end gap-2">
                <textarea
                  className="max-h-44 min-h-[60px] flex-1 resize-y rounded-xl px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ask the Void"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />

                <button
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
