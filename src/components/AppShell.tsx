import { useState, useEffect } from "react";
import TabBar from "./TabBar";
import HomeScreen from "../pages/HomeScreen";
import QuranScreen from "../pages/QuranScreen";
import HadithScreen from "../pages/HadithScreen";
import SearchScreen from "../pages/SearchScreen";
import AIChatScreen from "../pages/AIChatScreen";
import ProgressDashboard from "../pages/ProgressDashboard";
import NotificationSettingsScreen from "./NotificationSettings";
import { startNotificationScheduler } from "@/lib/notificationScheduler";

const AppShell = () => {
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    startNotificationScheduler();
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case "home": return <HomeScreen onNavigate={setActiveTab} />;
      case "quran": return <QuranScreen onBack={() => setActiveTab("home")} />;
      case "hadith": return <HadithScreen onBack={() => setActiveTab("home")} />;
      case "search": return <SearchScreen />;
      case "ai": return <AIChatScreen />;
      case "progress": return <ProgressDashboard onBack={() => setActiveTab("home")} onNavigate={setActiveTab} />;
      case "notif-settings": return <NotificationSettingsScreen onBack={() => setActiveTab("home")} />;
      default: return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div
      className="relative mx-auto overflow-hidden bg-background"
      style={{ maxWidth: 393, minHeight: "100dvh" }}
    >
      <div
        className="overflow-y-auto scrollbar-none animate-fade-slide-in"
        style={{ paddingBottom: 90 }}
        key={activeTab}
      >
        {renderScreen()}
      </div>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default AppShell;
