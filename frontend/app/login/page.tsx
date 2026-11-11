"use client";

import { useAuth } from "@/context/Authcontext";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "login" | "signup-email" | "signup-password";
const page = () => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };
  const switchToSignup = () => {
    resetForm();
    setMode("signup-email");
  };
  const switchToLogin = () => {
    resetForm();
    setMode("login");
  };
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters long.");
      setLoading(false);
      return;
    }
    // setTimeout(() => {
    //   router.push("/profiles");
    //   setLoading(false);
    // }, 800);
    try {
      const result = await login(email, password);
      if (result.success) {
        router.push("/profiles");
      }
      // router.push("/profiles");
    } catch (err: any) {
      setError(err.message || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignupEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name) {
      setError("Please enter your name.");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setMode("signup-password");
  };
  const handleSignupPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name) {
      setError("Please enter your name.");
      return;
    }
    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }
    // setTimeout(() => {
    //   router.push("/profiles");
    // }, 800);
    
    try {
      const result = await signup(name, email, password);
      if (result.success) {
        router.push("/profiles");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="https://images.pexels.com/photos/23384428/pexels-photo-23384428.jpeg?auto=compress&cs=tinysrgb&w=1280"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>{" "}
      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-4 md:px-12 py-5 border-b border-white/10 md:border-none">
          <span className="text-red-600 font-bold text-2xl md:text-4xl tracking-tighter select-none">
            NETFLIX
          </span>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md bg-black/75 rounded-md px-6 py-10 md:px-16 md:py-14">
            {/* ---------------- LOGIN ---------------- */}
            {mode === "login" && (
              <>
                <h1 className="text-white text-3xl font-bold mb-7">Sign In</h1>

                {error && (
                  <div className="bg-[#e87c03] text-white text-sm rounded px-4 py-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      className="peer w-full bg-[#333333] text-white rounded px-4 pt-5 pb-1.5 text-base focus:outline-none focus:ring-1 focus:ring-white transition-all"
                      autoComplete="email"
                    />
                    <label
                      htmlFor="email"
                      className={`absolute left-4 transition-all pointer-events-none text-white/60 ${
                        emailFocused || email
                          ? "top-1.5 text-xs"
                          : "top-1/2 -translate-y-1/2 text-base"
                      }`}
                    >
                      Email or phone number
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="peer w-full bg-[#333333] text-white rounded px-4 pt-5 pb-1.5 pr-12 text-base focus:outline-none focus:ring-1 focus:ring-white transition-all"
                      autoComplete="current-password"
                    />
                    <label
                      htmlFor="password"
                      className={`absolute left-4 transition-all pointer-events-none text-white/60 ${
                        passwordFocused || password
                          ? "top-1.5 text-xs"
                          : "top-1/2 -translate-y-1/2 text-base"
                      }`}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 text-white font-medium rounded py-3 mt-2 hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </button>

                  <div className="text-white/60 text-center text-sm py-2">
                    OR
                  </div>

                  <button
                    type="button"
                    className="w-full bg-white/10 text-white font-medium rounded py-3 hover:bg-white/20 transition-colors"
                  >
                    Use a Sign-In Code
                  </button>

                  <div className="text-center pt-1">
                    <a
                      href="#"
                      className="text-white/60 text-sm hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                </form>

                <div className="flex items-center justify-between mt-5 text-sm text-white/60">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${
                        rememberMe ? "bg-white/70" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-3 h-3 bg-black rounded-full transition-transform ${
                          rememberMe ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    Remember me
                  </label>
                  <a href="#" className="hover:underline">
                    Need help?
                  </a>
                </div>

                <div className="mt-7 space-y-3">
                  <p className="text-white/60 text-base">
                    New to Netflix?{" "}
                    <button
                      type="button"
                      onClick={switchToSignup}
                      className="text-white hover:underline font-medium"
                    >
                      Sign up now.
                    </button>
                  </p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    This page is protected by Google reCAPTCHA to ensure
                    you&apos;re not a bot.{" "}
                    <span className="text-blue-500 hover:underline cursor-pointer">
                      Learn more.
                    </span>
                  </p>
                </div>
              </>
            )}
            {/* ---------------- SIGNUP: EMAIL ---------------- */}
            {mode === "signup-email" && (
              <>
                <p className="text-white/50 text-xs font-medium tracking-wide mb-2">
                  STEP 1 OF 2
                </p>
                <h1 className="text-white text-3xl font-bold mb-2">
                  Welcome to Netflix.
                </h1>
                <p className="text-white/70 text-lg mb-6">
                  Enter your name and email to create or restart your
                  membership.
                </p>

                {error && (
                  <div className="bg-[#e87c03] text-white text-sm rounded px-4 py-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSignupEmailSubmit} className="space-y-4">
                  <div className="relative">
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      className="peer w-full bg-[#333333] text-white rounded px-4 pt-5 pb-1.5 text-base focus:outline-none focus:ring-1 focus:ring-white transition-all"
                      autoComplete="name"
                    />
                    <label
                      htmlFor="signup-name"
                      className={`absolute left-4 transition-all pointer-events-none text-white/60 ${
                        nameFocused || name
                          ? "top-1.5 text-xs"
                          : "top-1/2 -translate-y-1/2 text-base"
                      }`}
                    >
                      Name
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      className="peer w-full bg-[#333333] text-white rounded px-4 pt-5 pb-1.5 text-base focus:outline-none focus:ring-1 focus:ring-white transition-all"
                      autoComplete="email"
                    />
                    <label
                      htmlFor="signup-email"
                      className={`absolute left-4 transition-all pointer-events-none text-white/60 ${
                        emailFocused || email
                          ? "top-1.5 text-xs"
                          : "top-1/2 -translate-y-1/2 text-base"
                      }`}
                    >
                      Email address
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-red-600 text-white font-medium rounded py-3.5 flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                  >
                    Get Started
                    <span aria-hidden>›</span>
                  </button>
                </form>

                <p className="text-white/40 text-xs leading-relaxed mt-7">
                  This page is protected by Google reCAPTCHA to ensure
                  you&apos;re not a bot.{" "}
                  <span className="text-blue-500 hover:underline cursor-pointer">
                    Learn more.
                  </span>
                </p>

                <p className="text-white/60 text-sm mt-4">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={switchToLogin}
                    className="text-white hover:underline font-medium"
                  >
                    Sign in now.
                  </button>
                </p>
              </>
            )}

            {/* ---------------- SIGNUP: PASSWORD ---------------- */}
            {mode === "signup-password" && (
              <>
                <p className="text-white/50 text-xs font-medium tracking-wide mb-2">
                  STEP 2 OF 2
                </p>
                <h1 className="text-white text-3xl font-bold mb-2">
                  Create a password to start your membership.
                </h1>
                <p className="text-white/70 text-base mb-6">
                  Just a few more steps and you&apos;re done. We hate paperwork,
                  too.
                </p>

                {error && (
                  <div className="bg-[#e87c03] text-white text-sm rounded px-4 py-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="bg-[#333333]/60 rounded px-4 py-3 mb-4 flex items-center justify-between">
                  <span className="text-white/80 text-sm truncate">
                    {email}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <form
                  onSubmit={handleSignupPasswordSubmit}
                  className="space-y-4"
                >
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="peer w-full bg-[#333333] text-white rounded px-4 pt-5 pb-1.5 pr-12 text-base focus:outline-none focus:ring-1 focus:ring-white transition-all"
                      autoComplete="new-password"
                    />
                    <label
                      htmlFor="signup-password"
                      className={`absolute left-4 transition-all pointer-events-none text-white/60 ${
                        passwordFocused || password
                          ? "top-1.5 text-xs"
                          : "top-1/2 -translate-y-1/2 text-base"
                      }`}
                    >
                      Add a password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 text-white font-medium rounded py-3.5 hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {loading ? "Creating account..." : "Next"}
                  </button>
                </form>

                <p className="text-white/40 text-xs leading-relaxed mt-7">
                  This is a demo page. Any email and a 4+ character password
                  will work.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default page;
