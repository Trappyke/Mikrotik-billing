import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "../hooks/useToast";
import { setAuth } from "../lib/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("password"); // 'password' | '2fa'
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

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

    // Load Google Identity Services
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

      console.log("🔐 Login response received");
      console.log(
        "  Token:",
        response.data.token
          ? `YES (${response.data.token.substring(0, 25)}...)`
          : "NO!",
      );
      console.log("  User:", response.data.user);

      // Check if 2FA is required
      if (response.data.requires_2fa) {
        setTempToken(response.data.temp_token);
        setStep("2fa");
        setLoading(false);
        return;
      }

      // Save token using centralized auth manager
      const saved = setAuth(response.data.token, response.data.user);

      if (!saved) {
        console.error("❌ CRITICAL: Failed to save token!");
        toast.error("Login failed - could not save token");
        return;
      }

      // Verify token is actually in localStorage
      const verifyToken = localStorage.getItem("auth_token");
      console.log(
        "🔍 Verification - Token in storage:",
        verifyToken ? "YES" : "NO",
      );

      if (!verifyToken) {
        console.error(
          "❌ VERIFICATION FAILED: Token not in localStorage after setAuth!",
        );
        toast.error("Login failed - storage error");
        return;
      }

      toast.success("Login successful!");

      // Navigate to dashboard
      setTimeout(() => {
        console.log("🚀 Navigating to /");
        navigate("/");
      }, 200);
    } catch (error) {
      console.error("Login error:", error);
      console.error("Response data:", error.response?.data);
      console.error("Response status:", error.response?.status);
      console.error("Request URL:", error.config?.url);

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
        {
          email,
          password,
          two_factor_code: twoFactorCode,
        },
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );

      const saved = setAuth(response.data.token, response.data.user);

      if (!saved) {
        console.error("❌ CRITICAL: Failed to save token!");
        toast.error("Login failed - could not save token");
        return;
      }

      const verifyToken = localStorage.getItem("auth_token");
      if (!verifyToken) {
        console.error(
          "❌ VERIFICATION FAILED: Token not in localStorage after setAuth!",
        );
        toast.error("Login failed - storage error");
        return;
      }

      toast.success("Login successful!");

      setTimeout(() => {
        navigate("/");
      }, 200);
    } catch (error) {
      console.error("2FA error:", error);
      toast.error("Invalid code");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a1a2e 0%, #0f1117 50%, #0a0a0f 100%)",
      }}
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-5 shadow-2xl shadow-blue-500/20 ring-4 ring-blue-500/10">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              MikroTik
            </span>{" "}
            Billing
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
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
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
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all pr-12"
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
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center justify-center gap-2"
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
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-500/10 mb-3">
                  <Shield className="w-7 h-7 text-blue-400" />
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
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="000000"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={twoFactorCode.length !== 6 || loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/25"
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
          Secure ISP Management Platform
        </p>
      </div>
    </div>
  );
}
