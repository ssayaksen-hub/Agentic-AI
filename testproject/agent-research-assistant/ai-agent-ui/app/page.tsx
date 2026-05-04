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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_40%),#020617] text-slate-100">
      <div className="mx-auto flex h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-cyan-200/20 bg-slate-900/60 px-5 py-4 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Agent Console
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">AI Research Assistant</h1>
          <p className="mt-1 text-sm text-slate-300">Ask anything or summarize your indexed PDF content.</p>
        </header>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-[0_24px_70px_-40px_rgba(34,211,238,0.55)] backdrop-blur-xl">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-cyan-200/30 bg-slate-800/60 p-4 text-sm text-slate-300">
                Try: &quot;Summarize my PDF document&quot; or ask a research question.
              </div>
            ) : null}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[88%] rounded-2xl px-5 py-3 text-sm leading-6 shadow-md transition hover:scale-[1.01] ${
                  msg.role === "user"
                    ? "ml-auto border border-cyan-300/30 bg-gradient-to-r from-cyan-500 to-sky-500 text-white"
                    : "mr-auto border border-white/10 bg-white/10 text-white"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {msg.role === "user" ? "You" : "Assistant"}
                </p>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {loading ? <div className="animate-pulse text-cyan-300">Thinking...</div> : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/10 bg-slate-950/45 p-3 sm:p-4">
            <div className="flex items-end gap-2 sm:gap-3">
              <textarea
                className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border border-cyan-200/20 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/35 focus:outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
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
                className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
