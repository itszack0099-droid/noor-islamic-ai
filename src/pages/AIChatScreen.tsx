import { Send, Bot } from "lucide-react";
import { useState } from "react";

interface Message {
  role: "user" | "bot";
  content: string;
  references?: string[];
}

const initialMessages: Message[] = [
  {
    role: "bot",
    content: "Assalamu Alaikum! I'm NoorAI Scholar. I can help you understand the Quran, Hadith, and Islamic jurisprudence. What would you like to learn about today?",
  },
  {
    role: "user",
    content: "What does Islam say about Zakat? Who must pay it and how much?",
  },
  {
    role: "bot",
    content: "Zakat is one of the five pillars of Islam and is obligatory for every Muslim whose wealth exceeds the nisab (minimum threshold).\n\n**Who must pay:**\n• Adult Muslims who possess wealth above the nisab for a full lunar year\n• The nisab is equivalent to 85 grams of gold or 595 grams of silver\n\n**How much:**\n• 2.5% of total qualifying wealth annually\n• This includes savings, gold, silver, business inventory, and investments",
    references: ["Surah At-Tawbah 9:60", "Sahih Bukhari 1395"],
  },
];

const suggestions = [
  "What breaks your fast in Ramadan?",
  "How to perform Salatul Istikhara?",
  "Explain Surah Al-Fatiha",
];

const AIChatScreen = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    // Placeholder: AI response would come from backend
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: "Thank you for your question. Let me look into that for you based on authentic Islamic sources…",
        },
      ]);
    }, 1000);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0A0008" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 pb-3"
        style={{
          paddingTop: 65,
          background: "rgba(109,40,217,0.12)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(109,40,217,0.2)",
        }}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 38, height: 38, background: "linear-gradient(135deg, #4C1D95, #6D28D9)" }}
        >
          <Bot size={20} className="text-foreground" />
        </div>
        <div>
          <p className="text-foreground font-bold" style={{ fontSize: 16 }}>NoorAI Scholar</p>
          <p style={{ fontSize: 11, color: "#10B981" }}>● Online — Ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="px-4 py-3"
              style={{
                maxWidth: "75%",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background:
                  msg.role === "user"
                    ? "linear-gradient(135deg, #4C1D95, #6D28D9)"
                    : "rgba(255,255,255,0.06)",
                color: msg.role === "user" ? "#fff" : "rgba(255,255,255,0.88)",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
              {msg.references && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {msg.references.map((ref) => (
                    <span
                      key={ref}
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: 11,
                        background: "rgba(109,40,217,0.2)",
                        border: "1px solid rgba(109,40,217,0.3)",
                        color: "#A78BFA",
                      }}
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Suggestions */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
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
      </div>

      {/* Input */}
      <div
        className="px-4 pt-3"
        style={{
          background: "rgba(10,0,8,0.95)",
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          paddingBottom: 34,
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground px-4 py-3"
            placeholder="Ask anything…"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 22,
              fontSize: 14,
            }}
          />
          <button
            onClick={handleSend}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              background: "linear-gradient(135deg, #4C1D95, #6D28D9)",
              boxShadow: "0 0 20px rgba(109,40,217,0.4)",
            }}
          >
            <Send size={18} className="text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatScreen;
