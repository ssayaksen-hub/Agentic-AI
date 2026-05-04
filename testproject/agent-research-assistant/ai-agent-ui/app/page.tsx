"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
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
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "I could not reach the backend. Make sure FastAPI is running on 127.0.0.1:8000.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eef6ff_34%,#f8fafc_70%)] text-slate-900">
      <div className="mx-auto flex h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Research Assistant</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">AI Research Assistant</h1>
          <div className="mt-3 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
            Try: &quot;Summarize my PDF document&quot; or ask a research question.
          </div>
        </header>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)]">
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[88%] rounded-2xl px-5 py-3 text-sm leading-6 shadow-sm transition hover:scale-[1.01] ${
                  msg.role === "user"
                    ? "ml-auto border border-sky-200 bg-sky-100 text-slate-900"
                    : "mr-auto border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {msg.role === "user" ? "You" : "Assistant"}
                </p>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {loading ? <div className="animate-pulse text-slate-500">Thinking...</div> : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex items-end gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 shadow-sm">
                <textarea
                  className="max-h-48 min-h-16 flex-1 resize-y bg-transparent px-2 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
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
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
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
