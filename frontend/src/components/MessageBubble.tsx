import type { ChatMessage, ReporterMatch, ClarifyingData } from "../types";
import ClarifyingPrompts from "./ClarifyingPrompts";
import ReporterCard from "./ReporterCard";
import ExportBar from "./ExportBar";

interface Props {
  message: ChatMessage;
  onSend: (content: string, type: string) => void;
  loading: boolean;
  sessionId: string | null;
}

export default function MessageBubble({ message, onSend, loading, sessionId }: Props) {
  const isUser = message.role === "user";

  if (message.type === "clarification" && message.role === "assistant" && message.data) {
    const clarifyingData = message.data as ClarifyingData;
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-2xl w-full bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-3">{message.content}</p>
          <ClarifyingPrompts
            data={clarifyingData}
            onSubmit={(payload) => onSend(payload, "clarification")}
            disabled={loading}
          />
        </div>
      </div>
    );
  }

  if (message.type === "results" && message.role === "assistant" && message.data) {
    const matches = (message.data.matches ?? message.data) as ReporterMatch[];
    return (
      <div className="mb-4">
        <div className="flex justify-start mb-2">
          <div className="max-w-2xl bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-sm text-gray-700">{message.content}</p>
          </div>
        </div>
        <div className="space-y-3">
          {matches.map((m) => (
            <ReporterCard key={m.reporter.slug} match={m} />
          ))}
        </div>
        {sessionId && <ExportBar sessionId={sessionId} reporterCount={matches.length} />}
      </div>
    );
  }

  return (
    <div className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-50 border border-gray-200 text-gray-700"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
