import { useState } from "react";
import AppShell from "../components/AppShell";
import AuthPage from "./AuthPage";

const Index = () => {
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return <AuthPage onLogin={() => setAuthenticated(true)} />;
  }

  return <AppShell />;
};

export default Index;
