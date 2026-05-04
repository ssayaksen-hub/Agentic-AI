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
    <div className="flex h-screen">
      <div className="flex w-64 flex-col border-r border-white/10 bg-black/40 p-4 backdrop-blur-lg">
        <button
          onClick={createNewChat}
          className="mb-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-2"
        >
          New Chat
        </button>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {chats.map((chat, index) => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatIndex(index)}
              className={`cursor-pointer rounded-lg p-2 ${
                index === currentChatIndex ? "bg-purple-600" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              Chat {index + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="border-b border-white/10 bg-white/5 p-4 backdrop-blur-lg">AI Assistant</div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {currentChatIndex !== null &&
            chats[currentChatIndex].messages.map((msg: Message, i: number) => (
              <div
                key={i}
                className={`max-w-xl rounded-2xl px-5 py-3 shadow-lg ${
                  msg.role === "user"
                    ? "ml-auto bg-gradient-to-r from-purple-600 to-blue-500"
                    : "mr-auto border border-white/10 bg-white/10"
                }`}
              >
                {msg.content}
              </div>
            ))}

          {loading && <div className="animate-pulse text-purple-400">AI is thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-3 border-t border-white/10 bg-black/30 p-4">
          <input
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the void..."
            onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
          />

          <button
            onClick={() => void sendMessage()}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
