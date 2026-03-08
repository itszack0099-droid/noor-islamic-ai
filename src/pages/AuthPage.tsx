import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

interface AuthPageProps {
  onLogin: () => void;
}

const AuthPage = ({ onLogin }: AuthPageProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#0A0F0D" }}
    >
      {/* Logo */}
      <div className="text-center mb-10">
        <div
          className="mx-auto flex items-center justify-center rounded-2xl mb-4"
          style={{
            width: 64,
            height: 64,
            background: "linear-gradient(135deg, #1A7A4A, #25A566)",
            boxShadow: "0 0 40px rgba(37,165,102,0.3)",
          }}
        >
          <span className="font-arabic text-foreground font-bold" style={{ fontSize: 28 }}>ن</span>
        </div>
        <h1 className="text-foreground font-bold" style={{ fontSize: 28 }}>NoorAI</h1>
        <p className="text-muted-foreground mt-1" style={{ fontSize: 14 }}>Your Islamic Companion</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
        {isSignUp && (
          <div
            className="flex items-center gap-3 px-4"
            style={{
              height: 50,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
            }}
          >
            <User size={18} style={{ color: "rgba(255,255,255,0.35)" }} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="Full Name"
              style={{ fontSize: 14 }}
            />
          </div>
        )}

        <div
          className="flex items-center gap-3 px-4"
          style={{
            height: 50,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
          }}
        >
          <Mail size={18} style={{ color: "rgba(255,255,255,0.35)" }} />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            placeholder="Email"
            style={{ fontSize: 14 }}
            required
          />
        </div>

        <div
          className="flex items-center gap-3 px-4"
          style={{
            height: 50,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
          }}
        >
          <Lock size={18} style={{ color: "rgba(255,255,255,0.35)" }} />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            placeholder="Password"
            style={{ fontSize: 14 }}
            required
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <EyeOff size={18} style={{ color: "rgba(255,255,255,0.35)" }} />
            ) : (
              <Eye size={18} style={{ color: "rgba(255,255,255,0.35)" }} />
            )}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full font-bold text-foreground flex items-center justify-center gap-2"
          style={{
            height: 50,
            borderRadius: 14,
            background: "linear-gradient(135deg, #1A7A4A, #25A566)",
            fontSize: 15,
            marginTop: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {isSignUp ? "Create Account" : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 w-full max-w-sm mt-6">
        <div className="flex-1" style={{ height: 0.5, background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>or continue with</span>
        <div className="flex-1" style={{ height: 0.5, background: "rgba(255,255,255,0.1)" }} />
      </div>

      {/* Social Logins */}
      <div className="flex gap-3 mt-4 w-full max-w-sm">
        <button
          onClick={() => handleSocialLogin("google")}
          className="flex-1 flex items-center justify-center gap-2 font-semibold"
          style={{
            height: 50,
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.8)",
            fontSize: 14,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>
        <button
          onClick={() => handleSocialLogin("apple")}
          className="flex-1 flex items-center justify-center gap-2 font-semibold"
          style={{
            height: 50,
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.8)",
            fontSize: 14,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Apple
        </button>
      </div>

      {/* Toggle */}
      <p className="mt-8 text-center" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="font-semibold"
          style={{ color: "#25A566" }}
        >
          {isSignUp ? "Sign In" : "Sign Up"}
        </button>
      </p>
    </div>
  );
};

export default AuthPage;
