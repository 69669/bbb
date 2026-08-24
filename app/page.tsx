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

  useEffect(() => {
    // 已登录则跳转到后台管理
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
    }, 300);
  };

  return (
    <>
      <div className="bg-aurora" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-8">
        <div className="game-container">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎛️</div>
            <h1 className="text-2xl font-bold text-white">后台管理系统</h1>
            <p className="mt-3 text-sm text-white/50">激活码管理 · 工单管理</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理密码"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/50"
              autoFocus
              style={{ fontSize: "16px" }}
            />
            {error && (
              <div className="rounded-lg bg-red-500/10 p-2 text-center text-sm text-red-300">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 py-3 text-base font-semibold text-white shadow-lg shadow-pink-500/40 hover:shadow-pink-500/60 transition disabled:opacity-50"
            >
              {loading ? "验证中..." : "登 录"}
            </button>
          </form>
        </div>
        <div className="mt-6 text-center text-xs text-white/30">
          © 后台管理系统
        </div>
      </div>
    </>
  );
}
