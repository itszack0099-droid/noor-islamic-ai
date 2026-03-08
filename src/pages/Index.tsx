import { useState, useEffect } from "react";
import AppShell from "../components/AppShell";
import AuthPage from "./AuthPage";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full border-2 border-primary border-t-transparent" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!session) {
    return <AuthPage onLogin={() => {}} />;
  }

  return <AppShell />;
};

export default Index;
