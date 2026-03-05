import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../types";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  sessionId: string | null;
  onSend: (content: string, type: string) => void;
}

export default function ChatWindow({ messages, loading, sessionId, onSend }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSession = sessionId !== null || messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const hasResults = messages.some((m) => m.type === "results");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const type = !hasSession ? "brief" : hasResults ? "refinement" : "text";
    onSend(text, type);
  }

  return (
    <div className="flex flex-col flex-1 max-w-4xl w-full mx-auto">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Media Matching
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Paste your story brief below and HoneyJar will analyze it, ask a
                few clarifying questions, then find the reporters most likely to
                cover your story.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            onSend={onSend}
            loading={loading}
            sessionId={sessionId}
          />
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">Thinking</span>
                <span className="animate-pulse delay-100">.</span>
                <span className="animate-pulse delay-200">.</span>
                <span className="animate-pulse delay-300">.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 px-4 py-3 bg-white"
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Paste your story brief here..."
            rows={2}
            className="flex-1 resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="self-end rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
