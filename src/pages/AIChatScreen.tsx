import { Send, Bot, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const suggestions = [
  "What breaks your fast in Ramadan?",
  "How to perform Salatul Istikhara?",
  "Explain Surah Al-Fatiha",
];

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => "");
    onError(t || `Error ${resp.status}`);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* partial */ }
    }
  }
  onDone();
}

const AIChatScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setIsLoading(true);

    let assistantContent = "";

    const upsert = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent }];
      });
    };

    try {
      await streamChat({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        onError: (err) => {
          upsert(`⚠️ Error: ${err}`);
          setIsLoading(false);
        },
      });
    } catch {
      upsert("⚠️ Failed to connect to AI service.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#0A0008" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{
          background: "rgba(109,40,217,0.12)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(109,40,217,0.2)",
        }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 38, height: 38, background: "linear-gradient(135deg, #4C1D95, #6D28D9)" }}
        >
          <Bot size={20} color="#fff" />
        </div>
        <div>
          <p className="font-bold text-[16px]" style={{ color: "#F0F4F0" }}>NoorAI Scholar</p>
          <p style={{ fontSize: 11, color: "#10B981" }}>● Online — Ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 opacity-60">
            <Sparkles size={40} color="#A78BFA" />
            <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Assalamu Alaikum! Ask me anything about<br />Quran, Hadith, or Islamic jurisprudence.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="px-4 py-3"
              style={{
                maxWidth: "80%",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background:
                  msg.role === "user"
                    ? "linear-gradient(135deg, #4C1D95, #6D28D9)"
                    : "rgba(255,255,255,0.06)",
                color: msg.role === "user" ? "#fff" : "rgba(255,255,255,0.88)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-white">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div
              className="px-4 py-3 flex gap-1 items-center"
              style={{
                borderRadius: "18px 18px 18px 4px",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="shrink-0 px-3.5 py-2 rounded-full font-semibold"
                style={{
                  fontSize: 12,
                  background: "rgba(109,40,217,0.12)",
                  border: "1px solid rgba(109,40,217,0.2)",
                  color: "#A78BFA",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="px-4 pt-3 pb-4 shrink-0"
        style={{
          background: "rgba(10,0,8,0.95)",
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1 bg-transparent outline-none px-4 py-3"
            placeholder="Ask anything about Islam…"
            disabled={isLoading}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 22,
              fontSize: 14,
              color: "#F0F4F0",
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="flex items-center justify-center rounded-full shrink-0 disabled:opacity-40"
            style={{
              width: 40,
              height: 40,
              background: "linear-gradient(135deg, #4C1D95, #6D28D9)",
              boxShadow: "0 0 20px rgba(109,40,217,0.4)",
            }}
          >
            <Send size={18} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatScreen;
