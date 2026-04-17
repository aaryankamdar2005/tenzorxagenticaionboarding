"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: number;
  role: "user" | "agent";
  text: string;
}

interface ChatFallbackProps {
  socketRef: React.RefObject<WebSocket | null>;
  existingMessages: string[];
}

export default function ChatFallback({ socketRef, existingMessages }: ChatFallbackProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    existingMessages.map((text, i) => ({
      id: i,
      role: i % 2 === 0 ? "agent" : "user",
      text,
    }))
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(existingMessages.length);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    setMessages((prev) => [
      ...prev,
      { id: ++idRef.current, role: "user", text },
    ]);
    socketRef.current.send(JSON.stringify({ kind: "manual_transcript", text }));
    setInput("");
    setSending(true);
    setTimeout(() => setSending(false), 2000);
  }, [input, socketRef]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Listen for incoming agent replies and append as agent messages
  useEffect(() => {
    const ws = socketRef.current;
    if (!ws) return;
    const handler = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string);
        if (parsed.type === "AGENT_REPLY") {
          const text = String(parsed.payload?.text ?? "");
          if (text) {
            setMessages((prev) => [
              ...prev,
              { id: ++idRef.current, role: "agent", text },
            ]);
          }
        }
      } catch { /* noop */ }
    };
    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [socketRef]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-amber-400/30 bg-black/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-amber-400/20 px-4 py-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        <span className="text-sm font-medium text-amber-200">
          Text Mode — Network degraded. Continuing KYC via chat.
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-8">
            Your conversation will appear here. KYC continues via text.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                msg.role === "agent"
                  ? "bg-cyan-900/50 text-cyan-50 border border-cyan-500/30"
                  : "bg-slate-700/70 text-white border border-slate-500/30"
              }`}
            >
              {msg.role === "agent" && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                  Aria · Loan AI
                </p>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-amber-400/20 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your response… (Enter to send)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-600/50 bg-slate-900/70
              px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500
              focus:border-cyan-500/50 transition"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="self-end rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium
              text-white transition hover:bg-cyan-500 disabled:opacity-40"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Shift+Enter for new line</p>
      </div>
    </div>
  );
}
