"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "ai";
  content: string;
  steps?: string[];
};

type Chat = {
  id: number;
  messages: Message[];
  mode?: "normal" | "deep";
  title?: string;
  pinned?: boolean;
  inProject?: boolean;
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

function GenieThinkingLogo({ className = "h-16 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 108" className={className} xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="glBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ab8e8" />
          <stop offset="100%" stopColor="#3a7ac0" />
        </linearGradient>
        <linearGradient id="glVest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d3a52" />
          <stop offset="100%" stopColor="#1a2438" />
        </linearGradient>
      </defs>

      {/* ══ GRADUATION CAP ══ */}
      {/* Mortarboard flat board – perspective diamond */}
      <path d="M10 17 L40 6 L70 17 L40 28 Z" fill="#1a1a1a" />
      {/* Board underside/shadow edge */}
      <path d="M10 17 L10 21 L40 32 L70 21 L70 17" fill="#0d0d0d" />
      {/* Cylinder base of cap */}
      <rect x="29" y="24" width="22" height="10" rx="1" fill="#1a1a1a" />
      <ellipse cx="40" cy="24" rx="11" ry="3" fill="#252525" />
      <ellipse cx="40" cy="34" rx="11" ry="3" fill="#111" />
      {/* Tassel string from left corner of board */}
      <path d="M10 17 C8 20 8 25 9 31 C10 35 10 38 10 42" fill="none" stroke="#d4a820" strokeWidth="1.4" strokeLinecap="round" />
      {/* Tassel bundle */}
      <ellipse cx="10" cy="44" rx="3" ry="2.5" fill="#d4a820" />
      {/* Tassel fringe */}
      <line x1="7" y1="46" x2="5" y2="54" stroke="#c89018" strokeWidth="1.2" />
      <line x1="9" y1="46" x2="8" y2="55" stroke="#c89018" strokeWidth="1.2" />
      <line x1="11" y1="46" x2="11" y2="55" stroke="#c89018" strokeWidth="1.2" />
      <line x1="13" y1="46" x2="14" y2="54" stroke="#c89018" strokeWidth="1.2" />

      {/* ══ HEAD ══ */}
      <circle cx="40" cy="48" r="18" fill="url(#glBlue)" />
      {/* Left ear + gold earring */}
      <ellipse cx="22" cy="49" rx="2.5" ry="3.5" fill="#4a88c8" />
      <circle cx="22" cy="52" r="2.2" stroke="#e8b020" strokeWidth="1.6" fill="none" />
      {/* Right ear */}
      <ellipse cx="58" cy="49" rx="2.5" ry="3.5" fill="#4a88c8" />
      {/* Chin hint */}
      <path d="M33 65 C36 68 44 68 47 65" fill="none" stroke="#3a70b8" strokeWidth="1" opacity="0.5" />

      {/* Eyebrows – left flat, right raised (thinking) */}
      <path d="M26 37 C28 35 34 35 36 37" fill="none" stroke="#4a2808" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M43 35 C46 32 52 32 54 34" fill="none" stroke="#4a2808" strokeWidth="1.9" strokeLinecap="round" />

      {/* ══ GLASSES – thick dark rectangular frames ══ */}
      <rect x="22" y="40" width="15" height="11" rx="3" fill="white" fillOpacity="0.08" stroke="#111" strokeWidth="2.4" />
      <rect x="41" y="40" width="15" height="11" rx="3" fill="white" fillOpacity="0.08" stroke="#111" strokeWidth="2.4" />
      {/* Bridge */}
      <line x1="37" y1="45.5" x2="41" y2="45.5" stroke="#111" strokeWidth="2.2" />
      {/* Temple arms */}
      <path d="M22 45 C19 45 18 46 17 47" stroke="#111" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M56 45 C59 45 60 46 61 47" stroke="#111" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      <circle cx="29.5" cy="45.5" r="2.8" fill="#3a2808" />
      <circle cx="48.5" cy="45.5" r="2.8" fill="#3a2808" />
      <circle cx="30.5" cy="44.5" r="1" fill="white" />
      <circle cx="49.5" cy="44.5" r="1" fill="white" />

      {/* Nose */}
      <path d="M38 53 C37 56 39 57.5 41 56.5" fill="none" stroke="#3060a8" strokeWidth="1.3" strokeLinecap="round" />
      {/* Smirk */}
      <path d="M32 61 C36 64 45 63 48 61" fill="none" stroke="#2050a0" strokeWidth="1.6" strokeLinecap="round" />

      {/* ══ NECK ══ */}
      <rect x="37" y="66" width="6" height="8" rx="2" fill="#5b9bd5" />

      {/* ══ BODY ══ */}
      {/* White shirt */}
      <path d="M16 84 C14 74 18 66 26 64 L54 64 C62 66 66 74 64 84 C62 94 56 100 50 102 C45 104 35 104 30 102 C24 100 18 94 16 84 Z" fill="white" />
      {/* Dark vest – V-neck */}
      <path d="M26 64 C24 70 22 78 22 86 L58 86 C58 78 56 70 54 64 Z" fill="url(#glVest)" />
      {/* V-neck shirt showing */}
      <path d="M36 64 L40 78 L44 64" fill="white" />
      {/* Red tie */}
      <path d="M38 64 L40 76 L42 64 Z" fill="#b81818" />
      <path d="M39 63 L40 65 L41 63 Z" fill="#901010" />
      {/* Pocket right chest */}
      <rect x="47" y="70" width="8" height="7" rx="1" fill="#1a2438" />
      {/* Pencils */}
      <line x1="49" y1="70" x2="49" y2="65" stroke="#e83020" strokeWidth="1.4" />
      <line x1="51" y1="70" x2="51" y2="64" stroke="#2040d0" strokeWidth="1.4" />
      <line x1="53" y1="70" x2="53" y2="65" stroke="#20a020" strokeWidth="1.4" />

      {/* ══ LEFT ARM – holding book ══ */}
      <path d="M22 70 C15 74 12 80 13 88" fill="none" stroke="#5b9bd5" strokeWidth="9" strokeLinecap="round" />
      <path d="M13 88 C17 90 24 92 34 92" fill="none" stroke="#5b9bd5" strokeWidth="8.5" strokeLinecap="round" />
      {/* Cuff */}
      <ellipse cx="13" cy="88" rx="5" ry="4" fill="white" stroke="#dde5ee" strokeWidth="0.6" />
      <circle cx="13" cy="88" r="1.2" fill="#d8e0ea" />
      {/* Book */}
      <rect x="25" y="89" width="22" height="16" rx="2" fill="#1a4a28" stroke="#0e3018" strokeWidth="1.2" />
      <line x1="27" y1="91" x2="27" y2="103" stroke="#2a6a38" strokeWidth="1" />
      <rect x="25" y="94" width="22" height="4" rx="0.5" fill="none" stroke="#d4a820" strokeWidth="0.8" opacity="0.8" />

      {/* ══ RIGHT ARM – thinking pose, fist at chin ══ */}
      <path d="M58 70 C65 74 68 80 66 86" fill="none" stroke="#5b9bd5" strokeWidth="9" strokeLinecap="round" />
      <path d="M66 86 C63 82 56 75 50 70" fill="none" stroke="#5b9bd5" strokeWidth="8.5" strokeLinecap="round" />
      {/* Cuff */}
      <ellipse cx="66" cy="86" rx="5" ry="4" fill="white" stroke="#dde5ee" strokeWidth="0.6" />
      <circle cx="66" cy="86" r="1.2" fill="#d8e0ea" />
      {/* Fist under chin */}
      <ellipse cx="50" cy="69" rx="5.5" ry="5" fill="#5b9bd5" stroke="#3a7ac0" strokeWidth="1.2" />
      <path d="M46 67 C47 64 53 64 54 67" fill="none" stroke="#3a7ac0" strokeWidth="1" opacity="0.6" />

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
  const [chats, setChats] = useState<Chat[]>(() => {
    const fallback: Chat[] = [{ id: 0, messages: [], mode: "normal" }];
    if (typeof window === "undefined") return fallback;

    try {
      const saved = localStorage.getItem("ai_chats");
      if (!saved) return fallback;

      const parsed = JSON.parse(saved) as Chat[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
    } catch {
      return fallback;
    }
  });
  const [currentChatIndex, setCurrentChatIndex] = useState<number | null>(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [loadingChatId, setLoadingChatId] = useState<number | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>("chat");
  const [lampRefreshKey, setLampRefreshKey] = useState(0);
  const [openChatMenuId, setOpenChatMenuId] = useState<number | null>(null);

  const selectedChat = currentChatIndex === null ? null : (chats[currentChatIndex] ?? null);

  const messages = useMemo(
    () => (currentChatIndex === null ? [] : (chats[currentChatIndex]?.messages ?? [])),
    [chats, currentChatIndex],
  );
  useEffect(() => {
    localStorage.setItem("ai_chats", JSON.stringify(chats));
  }, [chats]);

  const hasStarted = chats.some((chat) => chat.messages.length > 0);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, steps]);

  const createNewChat = () => {
    const newChat: Chat = { id: Date.now(), messages: [], mode: "normal" };
    setChats((prev) => {
      const updated = [...prev, newChat];
      setCurrentChatIndex(updated.length - 1);
      return updated;
    });
  };

  const togglePinChat = (chatId: number) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat,
      ),
    );
  };

  const addChatToProject = (chatId: number) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, inProject: true } : chat,
      ),
    );
  };

  const renameChat = (chatId: number) => {
    const target = chats.find((chat) => chat.id === chatId);
    if (!target) return;
    const currentTitle = target.title ?? "";
    const nextTitle = window.prompt("Rename chat", currentTitle)?.trim();
    if (!nextTitle) return;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, title: nextTitle } : chat,
      ),
    );
  };

  const deleteChat = (chatId: number) => {
    setChats((prev) => {
      const deleteIndex = prev.findIndex((chat) => chat.id === chatId);
      if (deleteIndex < 0) return prev;

      let next = prev.filter((chat) => chat.id !== chatId);
      if (next.length === 0) {
        next = [{ id: Date.now(), messages: [], mode: "normal" }];
      }

      setCurrentChatIndex((prevIndex) => {
        if (prevIndex === null) return 0;
        if (prevIndex === deleteIndex) {
          return Math.max(0, Math.min(deleteIndex, next.length - 1));
        }
        if (prevIndex > deleteIndex) return prevIndex - 1;
        return prevIndex;
      });

      return next;
    });
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
    setSteps(["Thinking..."]);

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

        const deepData = (await deepRes.json()) as { answer?: string; steps?: string[] };
        chat.messages.push({
          role: "ai",
          content: deepData.answer?.trim() || "No answer received in deep mode.",
          steps: deepData.steps && deepData.steps.length > 0 ? deepData.steps : ["Thinking...", "Done"],
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
      const collectedSteps: string[] = [];

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
              collectedSteps.push(stepText);
              setSteps((prev) => [...prev, stepText]);
            } else if (event.type === "answer" && event.text) {
              chat.messages.push({ role: "ai", content: event.text, steps: [...collectedSteps] });
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

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://127.0.0.1:8000/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Upload failed (${res.status})`);
    }

    const data = (await res.json()) as {
      filename?: string;
      stored_filename?: string;
      original_filename?: string;
      rag_indexing?: string;
      rag_message?: string;
    };

    const storedFilename = data.stored_filename ?? data.filename ?? file.name;
    setUploadedFiles((prev) => [
      storedFilename,
      ...prev.filter((name) => name !== storedFilename),
    ]);

    return data;
  };

  const handleDeleteUploadedFile = async (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((name) => name !== fileName));

    try {
      await fetch(`http://127.0.0.1:8000/upload/${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });
    } catch {
      // Keep UI responsive even if delete request fails.
    }
  };

  return (
    <div
      className="flex h-screen bg-[#f7f3eb] text-slate-800"
      onClick={() => setOpenChatMenuId(null)}
    >
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
            .sort((a, b) => Number(Boolean(b.chat.pinned)) - Number(Boolean(a.chat.pinned)))
            .map(({ chat, index }) => {
            const lastQuestion =
              [...chat.messages].reverse().find((m) => m.role === "user")?.content ?? `Chat ${index + 1}`;
            const baseLabel = chat.title?.trim() || lastQuestion;
            const label = baseLabel.length > 22 ? baseLabel.slice(0, 22) + "…" : baseLabel;
            const isDeepChat = chat.mode === "deep";
            return (
              <div
                key={chat.id}
                onClick={() => {
                  setCurrentChatIndex(index);
                  setSidebarView("chat");
                  setOpenChatMenuId(null);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                  sidebarView === "chat" && index === currentChatIndex
                    ? "font-medium text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title={lastQuestion}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {chat.pinned && <span className="text-xs text-[#8b6a34]">📌</span>}
                  <span className="truncate">{label}</span>
                  {chat.inProject && (
                    <span className="rounded-full border border-[#c9d4be] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#4e6a3a]">
                      Project
                    </span>
                  )}
                  {isDeepChat && (
                    <span className="rounded-full border border-[#d9c8a8] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8b6a34]">
                      Deep
                    </span>
                  )}
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label="Chat options"
                    onClick={() => setOpenChatMenuId((prev) => (prev === chat.id ? null : chat.id))}
                    className="rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-[#e5dccb] hover:text-slate-800"
                  >
                    ☰
                  </button>

                  {openChatMenuId === chat.id && (
                    <div className="absolute right-0 top-7 z-20 w-36 rounded-md border border-[#d9cfbd] bg-[#fffdf8] py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          togglePinChat(chat.id);
                          setOpenChatMenuId(null);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-[#f1eadc]"
                      >
                        {chat.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addChatToProject(chat.id);
                          setOpenChatMenuId(null);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-[#f1eadc]"
                      >
                        Add to Project
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          renameChat(chat.id);
                          setOpenChatMenuId(null);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-[#f1eadc]"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteChat(chat.id);
                          setOpenChatMenuId(null);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-[#9a3d2b] transition hover:bg-[#f6e6df]"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
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
            hasStarted ? "top-6 text-[6rem]" : "top-1/2 -translate-y-32 text-[9rem]"
          }`}
        >
          <div className="flex items-center justify-center gap-4">
            <GenieThinkingLogo className={hasStarted ? "h-24 w-14" : "h-36 w-[86px]"} />
            <span>Genie</span>
          </div>
        </div>

        {/* Messages */}
        {hasStarted ? (
          <div className="absolute inset-x-0 top-44 bottom-44 w-full space-y-4 overflow-y-auto bg-[#f9f6ef] px-6 py-4">
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
                  {msg.role === "ai" ? (
                    <>
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="mb-2 flex flex-col gap-1">
                          {msg.steps.map((step, si) => (
                            <div key={si} className="flex items-center gap-1.5 text-xs italic text-slate-400">
                              <span className="inline-block h-1 w-1 flex-shrink-0 rounded-full bg-[#c4b89a]" />
                              {step}
                            </div>
                          ))}
                        </div>
                      )}
                      <MarkdownBody content={msg.content} />
                    </>
                  ) : msg.content}
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
            <div className="mt-6">
              <div className="mb-2 text-sm text-purple-300">📂 Knowledge Base</div>

              <label className="mb-3 block cursor-pointer rounded-xl bg-[#7b5e2a] px-3 py-2 text-center text-white transition hover:bg-[#5a4020]">
                Upload File
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void uploadFile(file);
                    }
                    e.target.value = "";
                  }}
                />
              </label>

              <div className="space-y-2">
                {uploadedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
                  >
                    <span className="min-w-0 truncate">📄 {file}</span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteUploadedFile(file)}
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-sm text-slate-500 transition hover:bg-[#f1eadc] hover:text-[#9a3d2b]"
                      aria-label={`Delete ${file}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-end gap-3 rounded-2xl border border-[#d6ccb8] bg-white px-3 py-3 pt-10 shadow-sm">
              {uploadedFiles.length > 0 && (
                <div className="absolute top-2 left-3 flex max-w-[70%] flex-wrap gap-1">
                  {uploadedFiles.slice(0, 3).map((file) => (
                    <span
                      key={`composer-${file}`}
                      className="max-w-[180px] truncate rounded-md border border-[#e4ddce] bg-[#f8f3e8] px-2 py-0.5 text-[11px] text-slate-600"
                      title={file}
                    >
                      📄 {file}
                    </span>
                  ))}
                  {uploadedFiles.length > 3 && (
                    <span className="rounded-md border border-[#e4ddce] bg-[#f8f3e8] px-2 py-0.5 text-[11px] text-slate-600">
                      +{uploadedFiles.length - 3} more
                    </span>
                  )}
                </div>
              )}
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


