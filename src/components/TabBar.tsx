import { Home, BookOpen, ScrollText, Search, Bot } from "lucide-react";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "quran", label: "Quran", icon: BookOpen },
  { id: "hadith", label: "Hadith", icon: ScrollText },
  { id: "search", label: "Search", icon: Search },
  { id: "ai", label: "AI", icon: Bot },
];

const TabBar = ({ activeTab, onTabChange }: TabBarProps) => {
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full glass-dark z-50"
      style={{
        maxWidth: 393,
        height: 116,
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-around pt-2 px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center gap-1 pt-1 transition-all duration-200"
              style={{ minWidth: 56 }}
            >
              <div
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 32,
                  height: 28,
                  borderRadius: 8,
                  background: isActive ? "rgba(37,165,102,0.15)" : "transparent",
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  style={{
                    color: isActive ? "#25A566" : "rgba(255,255,255,0.35)",
                    transition: "color 0.2s",
                  }}
                />
              </div>
              <span
                className="font-semibold"
                style={{
                  fontSize: 10,
                  color: isActive ? "#25A566" : "rgba(255,255,255,0.35)",
                  transition: "color 0.2s",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TabBar;
