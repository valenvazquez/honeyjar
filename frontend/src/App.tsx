import { useChat } from "./hooks/useChat";
import ChatWindow from "./components/ChatWindow";

export default function App() {
  const { sessionId, messages, loading, sendMessage, resetChat } = useChat();

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-amber-600">HoneyJar</h1>
        <button
          type="button"
          onClick={resetChat}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          New Chat
        </button>
      </header>

      <ChatWindow
        messages={messages}
        loading={loading}
        sessionId={sessionId}
        onSend={sendMessage}
      />
    </div>
  );
}
