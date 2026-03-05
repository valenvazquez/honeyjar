import { useState, useCallback, useEffect } from "react";
import type { ChatMessage } from "../types";

const API = "/api/chat";
const SESSION_KEY = "honeyjar_session_id";

export function useChat() {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    sessionStorage.getItem(SESSION_KEY),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      fetch(`${API}/sessions/${stored}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.messages?.length) {
            setSessionId(stored);
            setMessages(data.messages);
          } else {
            sessionStorage.removeItem(SESSION_KEY);
            setSessionId(null);
          }
        })
        .catch(() => {
          sessionStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        });
    }
  }, []);

  const createSession = useCallback(async () => {
    const res = await fetch(`${API}/sessions`, { method: "POST" });
    const data = await res.json();
    setSessionId(data.sessionId);
    sessionStorage.setItem(SESSION_KEY, data.sessionId);
    setMessages([]);
    return data.sessionId;
  }, []);

  const sendMessage = useCallback(
    async (content: string, type: string = "text") => {
      let sid = sessionId;
      if (!sid) {
        sid = await createSession();
      }
      setLoading(true);

      const userMessage: ChatMessage = {
        role: "user",
        content,
        type: type as ChatMessage["type"],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const res = await fetch(`${API}/sessions/${sid}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, type }),
        });
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
        return data.message;
      } catch {
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
          type: "text",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, createSession],
  );

  const resetChat = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
  }, []);

  return {
    sessionId,
    messages,
    loading,
    sendMessage,
    resetChat,
    createSession,
  };
}
