import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "../hooks/useToast";
import { setAuth } from "../lib/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const DEFAULT_BRANDING = {
  company_name: "MikroTik Billing",
  logo_url: null,
  primary_color: "#3b82f6",
  secondary_color: "#1e293b",
  accent_color: "#f59e0b",
  is_default: true,
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("password");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const navigate = useNavigate();
  const toast = useToast();

  // Fetch tenant branding on mount
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const slug = new URLSearchParams(window.location.search).get("tenant");
        const url = slug
          ? `${API_URL}/public/tenant-branding?slug=${slug}`
          : `${API_URL}/public/tenant-branding`;
        const { data } = await axios.get(url);
        setBranding(data);
        // Apply CSS variables for tenant colors
        document.documentElement.style.setProperty(
          "--tenant-primary",
          data.primary_color || DEFAULT_BRANDING.primary_color,
        );
        document.documentElement.style.setProperty(
          "--tenant-secondary",
          data.secondary_color || DEFAULT_BRANDING.secondary_color,
        );
        document.documentElement.style.setProperty(
          "--tenant-accent",
          data.accent_color || DEFAULT_BRANDING.accent_color,
        );
      } catch {
        setBranding(DEFAULT_BRANDING);
      }
    };
    fetchBranding();
  }, []);

  const primary = branding.primary_color || "#3b82f6";
  const secondary = branding.secondary_color || "#1e293b";

  const handleGoogleLogin = async () => {
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google Sign-In is not configured");
      return;
    }

    const initGoogleSignIn = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setLoading(true);
          try {
            const res = await axios.post(`${API_URL}/auth/google`, {
              credential: response.credential,
            });
            setAuth(res.data.token, res.data.user);
            toast.success(`Welcome ${res.data.user.name}`);
            navigate("/");
          } catch (err) {
            toast.error("Google sign-in failed");
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.prompt();
    };

    if (!window.google?.accounts?.id) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = () => initGoogleSignIn();
      document.head.appendChild(script);
    } else {
      initGoogleSignIn();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      if (response.data.requires_2fa) {
        setTempToken(response.data.temp_token);
        setStep("2fa");
        setLoading(false);
        return;
      }

      const saved = setAuth(response.data.token, response.data.user);
      if (!saved) {
        toast.error("Login failed - could not save token");
        return;
      }

      toast.success("Login successful!");
      setTimeout(() => navigate("/"), 200);
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || error.message || "Unknown error";
      toast.error("Login failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    if (twoFactorCode.length !== 6) return;
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/auth/login`,
        { email, password, two_factor_code: twoFactorCode },
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );

      const saved = setAuth(response.data.token, response.data.user);
      if (!saved) {
        toast.error("Login failed - could not save token");
        return;
      }

      toast.success("Login successful!");
      setTimeout(() => navigate("/"), 200);
    } catch (error) {
      toast.error("Invalid code");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top, ${secondary} 0%, #0f1117 50%, #0a0a0f 100%)`,
      }}
    >
      {/* Animated background blobs with tenant color */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${primary}15` }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl"
          style={{ backgroundColor: `${primary}10` }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{ backgroundColor: `${primary}08` }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Branded header */}
        <div className="text-center mb-8">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.company_name}
              className="h-16 mx-auto mb-5 object-contain"
            />
          ) : (
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 shadow-2xl ring-4 ring-white/5"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${branding.accent_color || primary})`,
                boxShadow: `0 0 40px ${primary}30`,
              }}
            >
              <Shield className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${primary}, ${branding.accent_color || primary})`,
              }}
            >
              {branding.company_name}
            </span>
          </h1>
          <p className="text-zinc-400 text-sm">
            Sign in to manage your ISP network
          </p>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-8 border border-zinc-800/50 shadow-2xl shadow-black/20">
          {step === "password" && (
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl border border-gray-200 transition-all hover:shadow-md"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-900 px-3 text-zinc-500 font-medium uppercase tracking-wider">
                    or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition-all"
                    style={{ focusRingColor: primary }}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 transition-all pr-12"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${primary}, ${branding.accent_color || primary})`,
                    boxShadow: `0 8px 24px ${primary}40`,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>
          )}

          {step === "2fa" && (
            <div className="space-y-5">
              <div className="text-center">
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3"
                  style={{ backgroundColor: `${primary}20` }}
                >
                  <Shield className="w-7 h-7" style={{ color: primary }} />
                </div>
                <h3 className="text-white font-semibold text-lg">
                  Two-Factor Authentication
                </h3>
                <p className="text-zinc-400 text-sm mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <form onSubmit={handle2FA} className="space-y-5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) =>
                    setTwoFactorCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2"
                  style={{ focusRingColor: primary }}
                  placeholder="000000"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={twoFactorCode.length !== 6 || loading}
                  className="w-full text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${primary}, ${branding.accent_color || primary})`,
                    boxShadow: `0 8px 24px ${primary}40`,
                  }}
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setStep("password")}
                className="w-full text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
              >
                ← Back to login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-zinc-600 text-xs mt-8">
          {branding.is_default
            ? "Secure ISP Management Platform"
            : `\u00a9 ${branding.company_name}`}
        </p>
      </div>
    </div>
  );
}
