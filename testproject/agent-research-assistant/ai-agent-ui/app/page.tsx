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
  const hasStarted = chats.some((chat) => chat.messages.length > 0);

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
    const question = input.trim();
    if (!question || currentChatIndex === null) return;

    const updatedChats = [...chats];
    const chat = updatedChats[currentChatIndex];

    chat.messages.push({ role: "user", content: question });

    setChats(updatedChats);
    setInput("");
    setLoading(true);

    const res = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();

    chat.messages.push({ role: "ai", content: data.answer });

    setChats([...updatedChats]);
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#f7f3eb] text-slate-800">
      {hasStarted ? (
        <div className="flex w-56 flex-col border-r border-[#e6dfd2] bg-[#efe8da] p-4">
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
      ) : null}

      <div className="relative flex flex-1 overflow-hidden">
        <div
          className={`font-genie absolute left-1/2 -translate-x-1/2 text-center leading-none tracking-wide text-slate-700 transition-all duration-700 ease-in-out ${
            hasStarted
              ? "top-4 text-5xl"
              : "top-1/2 -translate-y-24 text-8xl"
          }`}
        >
          Genie
        </div>

        {hasStarted ? (
          <div className="h-full w-full space-y-4 overflow-y-auto bg-[#f9f6ef] px-6 pt-28 pb-44">
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
        ) : null}

        <div
          className={`absolute left-1/2 w-full -translate-x-1/2 px-6 transition-all duration-700 ease-in-out ${
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
