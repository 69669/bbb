"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ADMIN_PASSWORD_HASH = 535441809;

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function Home() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("bbb_admin_authed") === "true") {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("请输入密码");
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(() => {
      if (simpleHash(password) === ADMIN_PASSWORD_HASH) {
        localStorage.setItem("bbb_admin_authed", "true");
        localStorage.setItem("bbb_admin_hash", String(simpleHash(password)));
        router.replace("/admin");
      } else {
        setError("密码错误，请重试");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <>
      <div className="bg-aurora" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md fade-in-up">
          {/* Logo区域 */}
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                boxShadow: "0 8px 32px rgba(99, 102, 241, 0.4)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="gradient-text text-2xl font-bold tracking-tight">管理控制台</h1>
            <p className="mt-2 text-sm text-white/40">Admin Console · 安全登录</p>
          </div>

          {/* 登录卡片 */}
          <div className="glass-card p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">
                  管理密码
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="输入密码以继续"
                    className="input-field"
                    style={{ fontSize: "16px", paddingLeft: "48px" }}
                    autoFocus
                  />
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={focused ? "#a5b4fc" : "rgba(255,255,255,0.3)"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>验证中</span>
                  </>
                ) : (
                  <>
                    <span>登 录</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-white/25">
            受保护区域 · 仅限授权管理员访问
          </div>
        </div>
      </div>
    </>
  );
}
