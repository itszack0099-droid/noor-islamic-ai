import { useState, useEffect } from "react";
import TabBar from "./TabBar";
import HomeScreen from "../pages/HomeScreen";
import QuranScreen from "../pages/QuranScreen";
import HadithScreen from "../pages/HadithScreen";
import SearchScreen from "../pages/SearchScreen";
import AIChatScreen from "../pages/AIChatScreen";
import ProgressDashboard from "../pages/ProgressDashboard";
import NoorDetectScreen from "../pages/NoorDetectScreen";
import NotificationSettingsScreen from "./NotificationSettings";
import LanguageSettings from "./LanguageSettings";
import BookmarksScreen from "./BookmarksScreen";
import ProfileScreen from "./ProfileScreen";
import SettingsScreen from "./SettingsScreen";
import { startNotificationScheduler } from "@/lib/notificationScheduler";
import { useI18n } from "@/lib/i18n";

const AppShell = () => {
  const [activeTab, setActiveTab] = useState("home");
  const { isRtl } = useI18n();
  const [quranInitialPage, setQuranInitialPage] = useState<number | undefined>();
  const [quranHighlightAyah, setQuranHighlightAyah] = useState<number | undefined>();

  useEffect(() => {
    startNotificationScheduler();
  }, []);

  const openQuranPage = (page: number, ayah: number) => {
    setQuranInitialPage(page);
    setQuranHighlightAyah(ayah);
    setActiveTab("quran");
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "home": return <HomeScreen onNavigate={setActiveTab} />;
      case "quran": return <QuranScreen onBack={() => setActiveTab("home")} initialPage={quranInitialPage} highlightAyah={quranHighlightAyah} />;
      case "hadith": return <HadithScreen onBack={() => setActiveTab("home")} onOpenLanguageSettings={() => setActiveTab("lang-settings")} />;
      case "search": return <SearchScreen onNavigateNoorDetect={() => setActiveTab("noordetect")} />;
      case "ai": return <AIChatScreen />;
      case "progress": return <ProgressDashboard onBack={() => setActiveTab("home")} onNavigate={setActiveTab} />;
      case "notif-settings": return <NotificationSettingsScreen onBack={() => setActiveTab("home")} />;
      case "lang-settings": return <LanguageSettings onBack={() => setActiveTab("home")} />;
      case "bookmarks": return <BookmarksScreen onBack={() => setActiveTab("home")} />;
      case "profile": return <ProfileScreen onBack={() => setActiveTab("home")} onNavigate={setActiveTab} />;
      case "noordetect": return <NoorDetectScreen onBack={() => setActiveTab("home")} onOpenQuranPage={openQuranPage} />;
      case "settings": return <SettingsScreen onBack={() => setActiveTab("home")} onNavigate={setActiveTab} />;
      default: return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div
      className="relative mx-auto overflow-hidden bg-background"
      style={{ maxWidth: 393, minHeight: "100dvh" }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className="overflow-y-auto scrollbar-none animate-fade-slide-in"
        style={{ paddingBottom: 90 }}
        key={activeTab}
      >
        {renderScreen()}
      </div>
      <TabBar activeTab={activeTab} onTabChange={(tab) => { setQuranInitialPage(undefined); setQuranHighlightAyah(undefined); setActiveTab(tab); }} />
    </div>
  );
};

export default AppShell;
