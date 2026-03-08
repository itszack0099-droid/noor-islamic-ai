import { useState } from "react";
import StatusBar from "./StatusBar";
import TabBar from "./TabBar";
import HomeScreen from "../pages/HomeScreen";
import QuranScreen from "../pages/QuranScreen";
import HadithScreen from "../pages/HadithScreen";
import SearchScreen from "../pages/SearchScreen";
import AIChatScreen from "../pages/AIChatScreen";

const AppShell = () => {
  const [activeTab, setActiveTab] = useState("home");

  const renderScreen = () => {
    switch (activeTab) {
      case "home": return <HomeScreen onNavigate={setActiveTab} />;
      case "quran": return <QuranScreen onBack={() => setActiveTab("home")} />;
      case "hadith": return <HadithScreen onBack={() => setActiveTab("home")} />;
      case "search": return <SearchScreen />;
      case "ai": return <AIChatScreen />;
      default: return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div
      className="relative mx-auto overflow-hidden bg-background"
      style={{ maxWidth: 393, minHeight: "100dvh" }}
    >
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50" style={{ maxWidth: 393, width: "100%" }}>
        <StatusBar />
      </div>
      <div
        className="overflow-y-auto scrollbar-none animate-fade-slide-in"
        style={{ paddingBottom: 116 }}
        key={activeTab}
      >
        {renderScreen()}
      </div>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default AppShell;
