"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError("");
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
        throw new Error("Request failed. Check that the backend is running.");
      }

      const data = await res.json();
      const aiMessage: Message = {
        role: "ai",
        content: typeof data.answer === "string" ? data.answer : "No response received.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "I could not reach the backend. Start the FastAPI server and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe,transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[28px] border border-white/70 bg-white/80 p-8 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Research Assistant
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                AI Agent Chat
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Ask general questions or request summaries from indexed PDF documents. Use
                Shift+Enter for a new line and Enter to send.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              Backend: <span className="font-medium text-slate-900">127.0.0.1:8000</span>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex min-h-[620px] flex-col rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)]">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Conversation</h2>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-500">
                  Start with a prompt like “Summarize my PDF document” or ask a general
                  research question.
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={`${msg.role}-${index}`}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-md ${
                      msg.role === "user"
                        ? "ml-auto bg-slate-900 text-white"
                        : "bg-sky-50 text-slate-800 ring-1 ring-sky-100"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                      {msg.role === "user" ? "You" : "Agent"}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))
              )}

              {loading ? (
                <div className="text-gray-500">AI is thinking...</div>
              ) : null}
              {loading ? (
                <div className="max-w-[85%] rounded-2xl bg-sky-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-sky-100">
                  Agent is thinking...
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-100 px-6 py-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-inner">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask something about the web or your indexed PDFs..."
                  className="min-h-28 w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <div className="mt-3 flex items-center justify-between gap-3 px-3 pb-1">
                  <p className="text-xs text-slate-500">Enter to send. Shift+Enter for newline.</p>
                  <button
                    onClick={() => void sendMessage()}
                    disabled={loading || !input.trim()}
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>

              {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)]">
              <h2 className="text-lg font-semibold text-slate-900">How To Use</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Ask direct questions for general research.</li>
                <li>Reference PDFs with phrases like “summarize my PDF”.</li>
                <li>Make sure your PDFs are indexed before document queries.</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.6)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                Backend Checklist
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <li>FastAPI running on port 8000.</li>
                <li>Ollama available for chat and embeddings.</li>
                <li>Indexed documents present in chroma_db.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
