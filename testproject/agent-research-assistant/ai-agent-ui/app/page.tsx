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
  mode?: "normal" | "deep";
};

const DEFAULT_LAMP_TOPICS = [
  "Global inflation outlook in 2026",
  "AI regulation trends across major economies",
  "Semiconductor geopolitics and supply chains",
  "Energy transition: nuclear vs renewables",
  "Water security and climate adaptation",
];

function randomizeTopics(topics: string[], count = 5): string[] {
  const arr = [...topics];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

function topicsSignature(topics: string[]): string {
  return topics.join("||");
}

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

function normalizeAiContent(raw: string): string {
  let text = raw
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

  // Convert compact single-line pipe-table output into readable sections.
  const pipeCount = (text.match(/\|/g) ?? []).length;
  const isDensePipeTable = pipeCount >= 8 && !text.includes("\n|");
  if (text.includes("|----------|") || text.includes("| ---") || isDensePipeTable) {
    const rowPattern = /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
    const rows: Array<{ left: string; right: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = rowPattern.exec(text)) !== null) {
      const left = match[1].trim();
      const right = match[2].trim();
      rows.push({ left, right });
    }

    if (rows.length >= 2) {
      const bodyRows = rows.filter(
        (row) =>
          row.left.toLowerCase() !== "category" &&
          !/^[-: ]+$/.test(row.left) &&
          !/^[-: ]+$/.test(row.right),
      );

      if (bodyRows.length > 0) {
        const blocks = bodyRows.map(({ left, right }) => {
          const normalizedRight = right
            .replace(/\s*\n\s*/g, "\n")
            .replace(/\s*•\s*/g, "\n- ")
            .replace(/^\s*-\s*/gm, "- ")
            .trim();
          return `### ${left}\n${normalizedRight}`;
        });

        // Preserve text after the final table row (for "Bottom line" style summaries).
        const lastRow = rows[rows.length - 1];
        const lastRowSnippet = `| ${lastRow.left} | ${lastRow.right} |`;
        const tailIndex = text.lastIndexOf(lastRowSnippet);
        const tail =
          tailIndex >= 0
            ? text.slice(tailIndex + lastRowSnippet.length).replace(/^\s+/, "")
            : "";

        text = blocks.join("\n\n");
        if (tail.trim()) {
          text += `\n\n${tail.trim()}`;
        }
      }
    }

    // Fallback parser for extremely compact one-line table text.
    if (!text.includes("### ") && pipeCount >= 8) {
      const cells = text
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      const filteredCells = cells.filter((cell) => !/^[-: ]+$/.test(cell));
      let start = 0;
      if (
        filteredCells.length >= 2 &&
        filteredCells[0].toLowerCase() === "category" &&
        filteredCells[1].toLowerCase() === "key points"
      ) {
        start = 2;
      }

      const blocks: string[] = [];
      for (let idx = start; idx + 1 < filteredCells.length; idx += 2) {
        const left = filteredCells[idx];
        const right = filteredCells[idx + 1]
          .replace(/\s*\n\s*/g, "\n")
          .replace(/\s*•\s*/g, "\n- ")
          .replace(/^\s*-\s*/gm, "- ")
          .trim();
        blocks.push(`### ${left}\n${right}`);
      }

      if (blocks.length > 0) {
        text = blocks.join("\n\n");
      }
    }
  }

  // Make unicode bullet-only lines render as a proper markdown list.
  text = text.replace(/^\s*•\s+/gm, "- ");

  // Add breathing room around "Bottom line:" style wrap-up statements.
  text = text.replace(/\s+(Bottom line:)/gi, "\n\n$1");

  return text;
}

function MarkdownBody({ content }: { content: string }) {
  const lines = normalizeAiContent(content).split("\n");
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

    // Section heading inside one answer card
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="mb-1 mt-4 text-sm font-semibold tracking-wide text-[#7b6543]">
          {renderInline(line.slice(4))}
        </h3>,
      );
      i++;
      continue;
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

function GenieLampIcon({ className = "h-5 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} xmlns="http://www.w3.org/2000/svg" fill="none">
      <ellipse cx="28" cy="28" rx="20" ry="8" fill="#c8a96e" opacity="0.3" />
      <path d="M10 26 Q8 18 16 14 Q24 10 34 16 Q42 20 44 26 Z" fill="#d4a843" />
      <path d="M44 22 Q52 18 58 20 Q54 26 44 26 Z" fill="#c8953a" />
      <path
        d="M10 24 Q2 20 4 14 Q6 8 12 12"
        stroke="#c8953a"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M22 14 Q28 8 34 14" stroke="#b8842a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M28 10 Q32 4 28 0" stroke="#b0a080" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />
      <path d="M28 10 Q24 5 28 1" stroke="#b0a080" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

function GenieThinkingLogo({ className = "h-16 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="genieBody" x1="32" y1="26" x2="72" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8da5bd" />
          <stop offset="1" stopColor="#5e7690" />
        </linearGradient>
        <linearGradient id="lampBody" x1="14" y1="58" x2="70" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2b65f" />
          <stop offset="1" stopColor="#b67e24" />
        </linearGradient>
      </defs>

      {/* Lamp */}
      <ellipse cx="36" cy="78" rx="27" ry="8" fill="#8f6b31" opacity="0.18" />
      <path d="M14 71 C12 59 25 52 41 54 C55 56 63 63 65 71 Z" fill="url(#lampBody)" stroke="#8f5c17" strokeWidth="2.2" />
      <path d="M65 66 C75 60 85 62 90 66 C85 74 75 75 65 72 Z" fill="#bf8328" stroke="#8f5c17" strokeWidth="1.8" />
      <path d="M15 69 C6 64 8 56 14 56" stroke="#8f5c17" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M33 53 C39 47 47 47 53 53" stroke="#8f5c17" strokeWidth="2.6" strokeLinecap="round" />

      {/* Genie near spout */}
      <path d="M60 57 C53 53 49 46 51 40 C53 33 60 30 67 33 C70 28 77 27 82 31 C87 35 87 43 82 47 C84 53 80 58 73 59 C68 60 64 59 60 57 Z" fill="url(#genieBody)" />
      <path d="M61 57 C57 64 52 68 46 70" stroke="#6f87a0" strokeWidth="2" strokeLinecap="round" />

      {/* Head */}
      <circle cx="70" cy="37" r="10" fill="#efc6a4" />
      <path d="M61 36 C61 31 65 28 70 28 C75 28 79 31 79 36" fill="#5b6e84" />

      {/* Glasses */}
      <circle cx="66" cy="38" r="3" stroke="#1f2937" strokeWidth="1.7" />
      <circle cx="74" cy="38" r="3" stroke="#1f2937" strokeWidth="1.7" />
      <path d="M69 38 H71" stroke="#1f2937" strokeWidth="1.4" />

      {/* Face */}
      <circle cx="66" cy="38" r="0.8" fill="#111827" />
      <circle cx="74" cy="38" r="0.8" fill="#111827" />
      <path d="M70 41 C69.3 42 69.7 43 70.6 43" stroke="#9c6c53" strokeWidth="1" strokeLinecap="round" />
      <path d="M67 45 C69 46 71 46 73 45" stroke="#9c6c53" strokeWidth="1.2" strokeLinecap="round" />

      {/* Thinking pose hand */}
      <path d="M76 46 C79 49 78 53 74 55" stroke="#efc6a4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="73.2" cy="55" r="1.5" fill="#efc6a4" />

      {/* Thought bubbles */}
      <circle cx="84" cy="24" r="2.5" fill="#c9d8e7" opacity="0.9" />
      <circle cx="89" cy="19" r="1.7" fill="#c9d8e7" opacity="0.75" />
      <circle cx="92" cy="14" r="1.1" fill="#c9d8e7" opacity="0.65" />
    </svg>
  );
}

// ── Lamp view ────────────────────────────────────────────────────────────────

function LampView({
  onResearch,
  onSwitchToChat,
}: {
  onResearch: (topic: string) => void;
  onSwitchToChat: () => void;
}) {
  const [topics, setTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const lastTopicsSigRef = useRef<string>("");

  const applyRandomizedTopics = (sourceTopics: string[]) => {
    let nextTopics = randomizeTopics(sourceTopics, 5);
    const nextSig = topicsSignature(nextTopics);
    if (nextSig === lastTopicsSigRef.current && nextTopics.length > 1) {
      const [first, ...rest] = nextTopics;
      if (first) {
        nextTopics = [...rest, first];
      }
    }
    lastTopicsSigRef.current = topicsSignature(nextTopics);
    setTopics(nextTopics);
  };

  useEffect(() => {
    const fetchTopics = async () => {
      setTopicsLoading(true);
      setTopicsError(false);
      try {
        const r = await fetch(`http://127.0.0.1:8000/lamp/topics?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          throw new Error(`lamp/topics failed: ${r.status}`);
        }
        const data = (await r.json()) as { topics?: string[]; error?: string };
        const fetched = Array.isArray(data.topics) ? data.topics : [];
        if (fetched.length > 0) {
          applyRandomizedTopics(fetched);
        } else {
          applyRandomizedTopics(DEFAULT_LAMP_TOPICS);
          if (data.error) {
            setTopicsError(true);
          }
        }
      } catch {
        applyRandomizedTopics(DEFAULT_LAMP_TOPICS);
        setTopicsError(true);
      } finally {
        setTopicsLoading(false);
      }
    };
    void fetchTopics();
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 overflow-y-auto px-8 py-12">
      {/* Header */}
      <div className="text-center">
        <div className="font-genie mb-1 flex items-center justify-center gap-3 text-4xl text-slate-700">
          <GenieLampIcon className="h-14 w-24" />
          Rub The Lamp
        </div>
        <p className="text-sm text-slate-400">
          Pick a current topic for a deep-dive investigation, or type your own.
        </p>
        <div
          onClick={onSwitchToChat}
          className="mt-2 cursor-pointer text-xs font-medium text-slate-500 transition hover:text-slate-700"
        >
          Switch to normal chat mode
        </div>
      </div>

      {/* Topic chips */}
      <div className="w-full max-w-2xl">
        {topicsLoading && (
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-40 animate-pulse rounded-full bg-[#e8e0d0]" />
            ))}
          </div>
        )}
        {topicsError && (
          <p className="text-center text-sm text-slate-400">
            Could not fetch topics — type your own below.
          </p>
        )}
        {!topicsLoading && !topicsError && topics.length > 0 && (
          <>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-[#b0a18a]">
              Trending Now
            </p>
            <div className="mb-3 flex justify-center">
              <button
                onClick={() => applyRandomizedTopics(topics.length > 0 ? topics : DEFAULT_LAMP_TOPICS)}
                className="rounded-full border border-[#d6ccb8] px-3 py-1 text-xs text-slate-500 transition hover:border-[#c4b08a] hover:text-slate-700"
              >
                Shuffle topics
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {topics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => onResearch(topic)}
                  className="rounded-full border border-[#d6ccb8] bg-[#faf6ee] px-4 py-2 text-sm text-slate-700 transition hover:border-[#c4b08a] hover:bg-[#f0e8d5] hover:text-slate-900"
                >
                  {topic}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="flex w-full max-w-2xl items-center gap-3">
        <div className="h-px flex-1 bg-[#e0d8cb]" />
        <span className="text-xs text-[#b0a08a]">or research your own</span>
        <div className="h-px flex-1 bg-[#e0d8cb]" />
      </div>

      {/* Custom topic input */}
      <div className="flex w-full max-w-2xl gap-3">
        <input
          type="text"
          className="flex-1 rounded-xl border border-[#d6ccb8] bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#d9c29d]"
          placeholder="Enter any topic to research deeply…"
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customTopic.trim()) {
              onResearch(customTopic.trim());
            }
          }}
        />
        <button
          onClick={() => { if (customTopic.trim()) onResearch(customTopic.trim()); }}
          disabled={!customTopic.trim()}
          className="rounded-xl bg-[#d9c29d] px-5 py-3 font-medium text-slate-900 transition hover:bg-[#ccb089] disabled:cursor-not-allowed disabled:bg-[#d8cfbf]"
        >
          Research
        </button>
      </div>
    </div>
  );
}

// ── Stub views ────────────────────────────────────────────────────────────────

function StubView({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
      <span className="text-5xl">{icon}</span>
      <h2 className="font-genie text-3xl text-slate-600">{title}</h2>
      <p className="text-sm text-slate-400">Coming soon…</p>
    </div>
  );
}

type SidebarView = "chat" | "artifacts" | "projects" | "lamp";

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([{ id: 0, messages: [], mode: "normal" }]);
  const [currentChatIndex, setCurrentChatIndex] = useState<number | null>(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<number | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>("chat");
  const [lampRefreshKey, setLampRefreshKey] = useState(0);

  const selectedChat = currentChatIndex === null ? null : (chats[currentChatIndex] ?? null);

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
    const newChat: Chat = { id: Date.now(), messages: [], mode: "normal" };
    setChats((prev) => [...prev, newChat]);
    setCurrentChatIndex(chats.length);
  };

  const sendMessage = async (
    overrideQuestion?: string,
    mode: "normal" | "deep" = "normal",
    forceNewChat = false,
  ) => {
    const question = (overrideQuestion ?? input).trim();
    if (!question) return;

    const updatedChats = [...chats];
    let targetIndex = currentChatIndex;

    if (forceNewChat || targetIndex === null || !updatedChats[targetIndex]) {
      updatedChats.push({ id: Date.now(), messages: [], mode });
      targetIndex = updatedChats.length - 1;
      setCurrentChatIndex(targetIndex);
    }

    const chat = updatedChats[targetIndex];
    if (mode === "deep") {
      chat.mode = "deep";
    }
    chat.messages.push({ role: "user", content: question });
    setChats(updatedChats);
    setInput("");
    setLoading(true);
    setLoadingChatId(chat.id);
    setSteps([]);

    try {
      if (mode === "deep") {
        setSteps([
          "Planning deep research",
          "Collecting sources",
          "Synthesizing findings",
        ]);

        const controller = new AbortController();
        const timeoutMs = 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let deepRes: Response;
        try {
          deepRes = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, mode: "deep" }),
            signal: controller.signal,
          });
        } catch {
          clearTimeout(timeoutId);
          setSteps(["Deep mode is slow right now", "Falling back to normal research"]);
          try {
            const fallbackRes = await fetch("http://127.0.0.1:8000/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question, mode: "normal" }),
            });
            if (fallbackRes.ok) {
              const fallbackData = (await fallbackRes.json()) as { answer?: string };
              chat.messages.push({
                role: "ai",
                content:
                  `Deep mode timed out, so I generated a quick response in normal mode.\n\n${fallbackData.answer?.trim() || "No answer received."}`,
              });
            } else {
              const errText = await fallbackRes.text();
              chat.messages.push({
                role: "ai",
                content: `Deep mode failed and fallback failed (${fallbackRes.status}): ${errText || "unknown error"}`,
              });
            }
            setChats([...updatedChats]);
          } catch (fallbackError) {
            chat.messages.push({
              role: "ai",
              content: `Deep mode request failed: ${fallbackError instanceof Error ? fallbackError.message : "unknown error"}`,
            });
            setChats([...updatedChats]);
          }
          return;
        }
        clearTimeout(timeoutId);

        if (!deepRes.ok) {
          const errText = await deepRes.text();
          chat.messages.push({
            role: "ai",
            content: `Deep research failed (${deepRes.status}): ${errText || "Unable to complete deep mode request."}`,
          });
          setChats([...updatedChats]);
          return;
        }

        const deepData = (await deepRes.json()) as { answer?: string };
        chat.messages.push({
          role: "ai",
          content: deepData.answer?.trim() || "No answer received in deep mode.",
        });
        setChats([...updatedChats]);
        return;
      }

      const res = await fetch("http://127.0.0.1:8000/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode }),
      });

      if (!res.ok) {
        const errText = await res.text();
        chat.messages.push({
          role: "ai",
          content: `Request failed (${res.status}): ${errText || "Unable to reach streaming endpoint."}`,
        });
        setChats([...updatedChats]);
        setLoading(false);
        setLoadingChatId(null);
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
        setLoadingChatId(null);
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
      setLoadingChatId(null);
      setSteps([]);
    }
  };

  // "Rub The Lamp" callback: create new deep-research chat and send
  const handleLampResearch = (topic: string) => {
    setSidebarView("chat");
    void sendMessage(topic, "deep", true);
  };

  return (
    <div className="flex h-screen bg-[#f7f3eb] text-slate-800">
      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-[#e6dfd2] bg-[#efe8da] transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hasStarted ? "w-56 opacity-100 p-4" : "w-0 overflow-hidden opacity-0 p-0"
        }`}
      >
        {/* New Chat */}
        <div
          onClick={() => { createNewChat(); setSidebarView("chat"); }}
          className="mb-3 cursor-pointer whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          + New Chat
        </div>

        {/* Nav items — shown directly under New Chat */}
        <div className="mb-3 space-y-0.5 border-b border-[#ddd4c0] pb-3">
          {([
            { view: "lamp" as SidebarView, label: "Rub The Lamp", icon: <GenieLampIcon className="h-6 w-10 flex-shrink-0" />, highlight: true },
            { view: "artifacts" as SidebarView, label: "Artifacts", icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 fill-current opacity-60" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/>
              </svg>
            ), highlight: false },
            { view: "projects" as SidebarView, label: "Projects", icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0 fill-current opacity-60" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
              </svg>
            ), highlight: false },
          ] as { view: SidebarView; label: string; icon: React.ReactNode; highlight: boolean }[]).map(({ view, label, icon, highlight }) => (
            <div
              key={view}
              onClick={() => {
                if (view === "lamp") {
                  setLampRefreshKey((k) => k + 1);
                }
                setSidebarView(view);
              }}
              className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition ${
                sidebarView === view
                  ? "font-medium text-slate-900"
                  : highlight
                  ? "text-[#7b5e2a] hover:text-[#5a4020]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {icon}
              {label}
            </div>
          ))}
        </div>

        {/* Chat list */}
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {chats
            .map((chat, index) => ({ chat, index }))
            .filter(({ chat }) => chat.messages.some((m) => m.role === "user"))
            .map(({ chat, index }) => {
            const lastQuestion =
              [...chat.messages].reverse().find((m) => m.role === "user")?.content ?? `Chat ${index + 1}`;
            const label = lastQuestion.length > 22 ? lastQuestion.slice(0, 22) + "…" : lastQuestion;
            const isDeepChat = chat.mode === "deep";
            return (
              <div
                key={chat.id}
                onClick={() => { setCurrentChatIndex(index); setSidebarView("chat"); }}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                  sidebarView === "chat" && index === currentChatIndex
                    ? "font-medium text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title={lastQuestion}
              >
                <span className="truncate">{label}</span>
                {isDeepChat && (
                  <span className="rounded-full border border-[#d9c8a8] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8b6a34]">
                    Deep
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 overflow-hidden">
        {sidebarView === "artifacts" && <StubView title="Artifacts" icon="🗂" />}
        {sidebarView === "projects" && <StubView title="Projects" icon="📁" />}
        {sidebarView === "lamp" && (
          <LampView
            key={lampRefreshKey}
            onResearch={handleLampResearch}
            onSwitchToChat={() => setSidebarView("chat")}
          />
        )}
        {sidebarView === "chat" && (
          <>
        {/* Genie title */}
        <div
          className={`font-genie absolute left-1/2 z-10 -translate-x-1/2 text-center leading-none tracking-wide text-slate-700 transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hasStarted ? "top-4 text-5xl" : "top-1/2 -translate-y-32 text-7xl"
          }`}
        >
          <div className="flex items-center justify-center gap-3">
            <GenieThinkingLogo className={hasStarted ? "h-10 w-12" : "h-14 w-16"} />
            <span>Genie</span>
          </div>
        </div>

        {/* Messages */}
        {hasStarted ? (
          <div className="h-full w-full space-y-4 overflow-y-auto bg-[#f9f6ef] px-6 pt-28 pb-44">
            {selectedChat &&
              selectedChat.messages.map((msg: Message, i: number) => (
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

            {loading && selectedChat?.id === loadingChatId && <ThinkingCloud steps={steps} />}
            <div ref={bottomRef} />
          </div>
        ) : null}

        {/* Composer */}
        <div
          className={`absolute left-1/2 w-full -translate-x-1/2 px-6 transition-all duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hasStarted ? "bottom-7" : "top-1/2 translate-y-6"
          }`}
        >
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex items-end gap-3 rounded-2xl border border-[#d6ccb8] bg-white px-3 py-3 shadow-sm">
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

            {!hasStarted && (
              <div className="mt-3 flex items-center justify-center">
                <div
                  onClick={() => {
                    setLampRefreshKey((k) => k + 1);
                    setSidebarView("lamp");
                  }}
                  className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#7b5e2a] transition hover:text-[#5a4020]"
                >
                  <GenieLampIcon className="h-7 w-12" />
                  <span>Rub The Lamp</span>
                  <span className="text-xs font-normal text-[#9b8967]">(for deep research topics)</span>
                </div>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}


