import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  Wifi,
  Zap,
  Users,
  Globe,
} from "lucide-react";
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

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const slug = new URLSearchParams(window.location.search).get("tenant");
        const url = slug
          ? `${API_URL}/public/tenant-branding?slug=${slug}`
          : `${API_URL}/public/tenant-branding`;
        const { data } = await axios.get(url);
        setBranding(data);
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
  const accent = branding.accent_color || "#f59e0b";

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
        toast.error("Login failed");
        return;
      }
      toast.success("Login successful!");
      setTimeout(() => navigate("/"), 200);
    } catch (error) {
      toast.error("Login failed", error.response?.data?.error || error.message);
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
        toast.error("Login failed");
        return;
      }
      toast.success("Login successful!");
      setTimeout(() => navigate("/"), 200);
    } catch {
      toast.error("Invalid code");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ─── LEFT: BRANDING PANEL ─── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center p-16"
        style={{
          background: `linear-gradient(160deg, ${secondary} 0%, #0a0a10 60%, #050508 100%)`,
        }}
      >
        {/* Animated blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ backgroundColor: `${primary}15` }}
          />
          <div
            className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px]"
            style={{ backgroundColor: `${accent}10` }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-md text-center">
          {/* Logo */}
          <div className="mb-10">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.company_name}
                className="h-20 w-auto max-w-[280px] object-contain mx-auto"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${primary}, ${accent})`,
                  boxShadow: `0 0 60px ${primary}40, 0 20px 40px ${primary}20`,
                }}
              >
                <Shield className="w-12 h-12 text-white" />
              </div>
            )}
          </div>

          {/* Company Name */}
          <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            {branding.company_name}
          </h1>

          {/* Tagline */}
          <p className="text-lg text-zinc-400 mb-10 leading-relaxed max-w-sm">
            {branding.is_default
              ? "Complete ISP management platform for MikroTik networks"
              : "Your trusted internet service provider"}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { icon: Wifi, label: "Hotspot Management" },
              { icon: Zap, label: "Real-time Billing" },
              { icon: Users, label: "Customer Portal" },
              { icon: Globe, label: "Multi-Tenant" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: `${primary}15`,
                  color: primary,
                  border: `1px solid ${primary}20`,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom attribution */}
        <div className="absolute bottom-8 text-center">
          <p className="text-xs text-zinc-600">
            {branding.is_default
              ? "Secure ISP Management Platform"
              : `\u00a9 ${branding.company_name}`}
          </p>
        </div>
      </div>

      {/* ─── RIGHT: LOGIN FORM ─── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-zinc-950">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo (visible only on small screens) */}
          <div className="lg:hidden text-center mb-8">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.company_name}
                className="h-12 mx-auto mb-3 object-contain"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{
                  background: `linear-gradient(135deg, ${primary}, ${accent})`,
                }}
              >
                <Shield className="w-7 h-7 text-white" />
              </div>
            )}
            <h2 className="text-xl font-bold text-white">
              {branding.company_name}
            </h2>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">
              {step === "2fa" ? "Two-Factor Auth" : "Welcome back"}
            </h2>
            <p className="text-zinc-400 text-sm">
              {step === "2fa"
                ? "Enter your authenticator code"
                : "Sign in to your account to continue"}
            </p>
          </div>

          <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-8 border border-zinc-800/50">
            {step === "password" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm"
                    style={{ "--tw-ring-color": primary }}
                    placeholder="admin@yourisp.com"
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
                      className="w-full px-4 py-3.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all text-sm pr-12"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  style={{
                    background: `linear-gradient(135deg, ${primary}, ${accent})`,
                    boxShadow: `0 8px 24px ${primary}40`,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-zinc-900 px-3 text-zinc-600">or</span>
                  </div>
                </div>

                {/* Google Sign-In */}
                <button
                  type="button"
                  onClick={() => {
                    const GOOGLE_CLIENT_ID = import.meta.env
                      .VITE_GOOGLE_CLIENT_ID;
                    if (!GOOGLE_CLIENT_ID) {
                      toast.error("Google Sign-In not configured");
                      return;
                    }
                    const init = () => {
                      window.google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: async (r) => {
                          setLoading(true);
                          try {
                            const res = await axios.post(
                              `${API_URL}/auth/google`,
                              { credential: r.credential },
                            );
                            setAuth(res.data.token, res.data.user);
                            toast.success(`Welcome ${res.data.user.name}`);
                            navigate("/");
                          } catch {
                            toast.error("Google sign-in failed");
                            setLoading(false);
                          }
                        },
                      });
                      window.google.accounts.id.prompt();
                    };
                    if (!window.google?.accounts?.id) {
                      const s = document.createElement("script");
                      s.src = "https://accounts.google.com/gsi/client";
                      s.onload = init;
                      document.head.appendChild(s);
                    } else init();
                  }}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 font-medium py-3 px-4 rounded-xl border border-zinc-700/50 transition-all text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              </form>
            )}

            {step === "2fa" && (
              <form onSubmit={handle2FA} className="space-y-5">
                <div className="text-center">
                  <div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3"
                    style={{ backgroundColor: `${primary}20` }}
                  >
                    <Shield className="w-7 h-7" style={{ color: primary }} />
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) =>
                    setTwoFactorCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2"
                  placeholder="000000"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={twoFactorCode.length !== 6 || loading}
                  className="w-full text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 shadow-lg text-sm"
                  style={{
                    background: `linear-gradient(135deg, ${primary}, ${accent})`,
                    boxShadow: `0 8px 24px ${primary}40`,
                  }}
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("password")}
                  className="w-full text-zinc-500 text-sm hover:text-zinc-300"
                >
                  ← Back
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
