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

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("bbb_admin_authed") === "true") {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { setError("请输入管理密码"); return; }
    setLoading(true);
    setError("");
    setTimeout(() => {
      if (simpleHash(password) === ADMIN_PASSWORD_HASH) {
        localStorage.setItem("bbb_admin_authed", "true");
        localStorage.setItem("bbb_admin_hash", String(simpleHash(password)));
        localStorage.setItem("lg_admin_auth", "1");
        localStorage.setItem("lg_admin_hash", String(simpleHash(password)));
        router.replace("/admin");
      } else {
        setError("密码错误，请重试");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc" }}>
      {/* 左侧品牌区 */}
      <div className="brand-side" style={{
        flex: 1,
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px", position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", top: "-100px", right: "-100px" }} />
        <div style={{ position: "absolute", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", bottom: "-80px", left: "-80px" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "440px" }}>
          <div style={{ width: "56px", height: "56px", background: "rgba(255,255,255,0.2)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "28px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: 800, color: "white", marginBottom: "16px", lineHeight: 1.2 }}>BBB 管理控制台</h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: "40px" }}>激活码管理 · 工单系统 · 数据统计<br />一站式后台管理平台</p>
          <div style={{ display: "flex", gap: "32px" }}>
            <div><div style={{ fontSize: "28px", fontWeight: 700, color: "white" }}>3+</div><div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>功能模块</div></div>
            <div><div style={{ fontSize: "28px", fontWeight: 700, color: "white" }}>99.9%</div><div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>服务可用</div></div>
            <div><div style={{ fontSize: "28px", fontWeight: 700, color: "white" }}>v9.0</div><div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>全新版本</div></div>
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div style={{ width: "480px", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>欢迎回来</h2>
            <p style={{ fontSize: "14px", color: "#64748b" }}>请输入密码登录管理后台</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>管理密码</label>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码"
                  style={{ width: "100%", padding: "11px 44px 11px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", background: "#f8fafc", outline: "none" }}
                  onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "white"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; e.target.style.boxShadow = "none"; }}
                  autoFocus />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "13px", color: "#dc2626", marginBottom: "16px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "12px", background: loading ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
              {loading ? (<><span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />验证中...</>) : "登 录"}
            </button>
          </form>
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#94a3b8" }}>受保护区域 · 仅限授权管理员访问</p>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @media (max-width: 768px) { .brand-side { display: none !important; } }`}</style>
    </div>
  );
}
