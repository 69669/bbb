"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://api.ttla.top";
const ADMIN_HASH = 535441809;

export default function AdminHome() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [stats, setStats] = useState({ total: 0, online: 0 });

  useEffect(() => {
    if (localStorage.getItem("bbb_admin_authed") !== "true") {
      router.replace("/");
    } else {
      setAuthed(true);
      fetchFreeMode();
      fetchStats();
    }
  }, [router]);

  const fetchFreeMode = async () => {
    try {
      const res = await fetch(`${API_BASE}/config/free-mode`);
      const data = await res.json();
      setFreeMode(!!data.freeMode);
    } catch (e) {}
  };

  const fetchStats = async () => {
    try {
      const [onlineRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/online/count`),
        fetch(`${API_BASE}/stats`),
      ]);
      const onlineData = await onlineRes.json();
      const statsData = await statsRes.json();
      setStats({
        total: statsData.totalUsed || 0,
        online: onlineData.online || 0,
      });
    } catch (e) {}
  };

  const toggleFreeMode = async () => {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch(`${API_BASE}/config/free-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash: ADMIN_HASH, enabled: !freeMode }),
      });
      const data = await res.json();
      if (data.success) {
        setFreeMode(data.freeMode);
        setStatusMsg(data.freeMode ? "已开启限时免费" : "已关闭免费模式");
      } else {
        setStatusMsg(data.message || "操作失败");
      }
    } catch (e) {
      setStatusMsg("网络错误，请重试");
    }
    setLoading(false);
    setTimeout(() => setStatusMsg(""), 2500);
  };

  const handleLogout = () => {
    localStorage.removeItem("bbb_admin_authed");
    localStorage.removeItem("bbb_admin_hash");
    localStorage.removeItem("lg_admin_hash");
    localStorage.removeItem("ticket_admin_hash");
    router.replace("/");
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070b]">
        <div className="spinner" />
      </div>
    );
  }

  const menuItems = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      ),
      title: "激活码管理",
      desc: "生成、管理、导出激活码",
      path: "/tools/gen-license",
      color: "#6366f1",
      bgGlow: "rgba(99, 102, 241, 0.15)",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      title: "工单管理",
      desc: "处理用户反馈和工单",
      path: "/ticket-admin.html",
      color: "#a855f7",
      bgGlow: "rgba(168, 85, 247, 0.15)",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: "更新历史",
      desc: "查看项目版本更新记录",
      path: "/update-history.html",
      color: "#f59e0b",
      bgGlow: "rgba(245, 158, 11, 0.15)",
    },
  ];

  return (
    <>
      <div className="bg-aurora" />
      <div className="relative z-10 mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:py-12">
        {/* 顶部栏 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="gradient-text text-xl font-bold tracking-tight sm:text-2xl">管理控制台</h1>
            <p className="mt-1 text-xs text-white/40">Admin Console</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-3.5 py-2 text-xs text-white/50 transition hover:border-white/15 hover:bg-white/5 hover:text-white/80"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            退出
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="mt-1 text-[11px] text-white/40">累计激活</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.online}</div>
            <div className="mt-1 text-[11px] text-white/40">当前在线</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className={`text-2xl font-bold ${freeMode ? "text-amber-400" : "text-white/30"}`}>
              {freeMode ? "FREE" : "—"}
            </div>
            <div className="mt-1 text-[11px] text-white/40">{freeMode ? "免费中" : "付费模式"}</div>
          </div>
        </div>

        {/* 全局免费模式开关 */}
        <div
          className="glass-card mb-6 p-5"
          style={{
            borderColor: freeMode ? "rgba(34, 197, 94, 0.25)" : undefined,
            background: freeMode ? "rgba(34, 197, 94, 0.04)" : undefined,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: freeMode ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={freeMode ? "#4ade80" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                  <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">全局限时免费</span>
                  {freeMode && <span className="badge badge-success">已开启</span>}
                </div>
                <p className="mt-0.5 text-xs text-white/40">开启后所有游戏免费玩，首页显示「限时免费」</p>
              </div>
            </div>
            <button
              onClick={toggleFreeMode}
              disabled={loading}
              style={{
                position: "relative",
                width: "48px",
                height: "28px",
                borderRadius: "999px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                background: freeMode ? "#22c55e" : "rgba(255,255,255,0.12)",
                transition: "background 0.3s",
                opacity: loading ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: "3px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "999px",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                  transform: freeMode ? "translateX(20px)" : "translateX(0)",
                }}
              />
            </button>
          </div>
          {statusMsg && (
            <div className="mt-3 text-xs text-white/50">{statusMsg}</div>
          )}
        </div>

        {/* 功能卡片 */}
        <div className="grid gap-3 sm:grid-cols-3">
          {menuItems.map((item, i) => (
            <button
              key={item.path}
              onClick={() => {
                if (item.path.endsWith(".html")) {
                  window.open(item.path, "_blank");
                } else {
                  router.push(item.path);
                }
              }}
              className="glass-card group p-5 text-left fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                style={{ background: item.bgGlow, color: item.color }}
              >
                {item.icon}
              </div>
              <h2 className="text-sm font-semibold text-white">{item.title}</h2>
              <p className="mt-1 text-xs text-white/40">{item.desc}</p>
              <div className="mt-3 flex items-center text-xs text-white/30 transition group-hover:text-white/60">
                进入
                <svg className="ml-1 transition-transform group-hover:translate-x-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
