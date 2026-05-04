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
    if (!input || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const res = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: input }),
    });

    const data = await res.json();

    const aiMessage: Message = { role: "ai", content: data.answer };
    setMessages((prev) => [...prev, aiMessage]);

    setLoading(false);
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.2),transparent)]"></div>
      <div className="border-b border-white/10 bg-white/5 p-4 text-lg font-semibold tracking-wide backdrop-blur-lg">
        AI Research Assistant
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-xl rounded-2xl px-5 py-3 shadow-lg backdrop-blur-md hover:scale-[1.01] transition ${
              msg.role === "user"
                ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-500 text-white"
                : "mr-auto bg-white/10 border border-white/10 text-white glow"
            }`}
          >
            {msg.content}
          </div>
        ))}

        {loading && <div className="animate-pulse text-purple-400">AI is thinking...</div>}

        <div ref={bottomRef} />
      </div>

      <div className="flex gap-3 border-t border-white/10 bg-white/5 p-4 backdrop-blur-lg">
        <input
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the void..."
          onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
        />

        <button
          onClick={() => void sendMessage()}
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 transition hover:opacity-90"
        >
          Send
        </button>
      </div>
    </div>
  );
}
