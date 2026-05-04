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

  const sendMessage = async () => {
    if (!input || currentChatIndex === null) return;

    const updatedChats = [...chats];
    const chat = updatedChats[currentChatIndex];

    chat.messages.push({ role: "user", content: input });

    setChats(updatedChats);
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

    chat.messages.push({ role: "ai", content: data.answer });

    setChats([...updatedChats]);
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#f7f3eb] text-slate-800">
      <div className="flex w-64 flex-col border-r border-[#e6dfd2] bg-[#efe8da] p-4">
        <button
          onClick={createNewChat}
          className="mb-4 rounded-xl border border-[#d7cdb8] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#f8f4ea]"
        >
          + New Chat
        </button>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {chats.map((chat, index) => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatIndex(index)}
              className={`cursor-pointer rounded-lg p-2 text-sm transition ${
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

      <div className="flex flex-1 flex-col">
        <div className="border-b border-[#e6dfd2] bg-[#f7f3eb] p-4 text-sm font-medium text-slate-600">
          AI Assistant
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#f9f6ef] p-6">
          {currentChatIndex !== null &&
            chats[currentChatIndex].messages.map((msg: Message, i: number) => (
              <div
                key={i}
                className={`max-w-2xl rounded-2xl px-5 py-3 text-[15px] leading-7 shadow-sm ${
                  msg.role === "user"
                    ? "ml-auto border border-[#ddd3be] bg-[#efe6d4] text-slate-900"
                    : "mr-auto border border-[#e4ddce] bg-white text-slate-800"
                }`}
              >
                {msg.content}
              </div>
            ))}

          {loading && <div className="animate-pulse text-slate-500">AI is thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-3 border-t border-[#e6dfd2] bg-[#f7f3eb] p-4">
          <input
            className="flex-1 rounded-xl border border-[#d6ccb8] bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-[#b8ab92] focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the void..."
            onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
          />

          <button
            onClick={() => void sendMessage()}
            disabled={loading}
            className="rounded-xl bg-[#2f2f2f] px-4 py-2 text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
