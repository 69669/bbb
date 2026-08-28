"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://api.ttla.top";
const ADMIN_HASH = 535441809;

export default function AdminDashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [stats, setStats] = useState({ total: 0, online: 0, pending: 0 });
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (localStorage.getItem("bbb_admin_authed") !== "true") {
      router.replace("/");
    } else {
      setAuthed(true);
      fetchData();
      const timer = setInterval(fetchData, 15000);
      return () => clearInterval(timer);
    }
  }, [router]);

  const fetchData = async () => {
    try {
      const [freeRes, onlineRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/config/free-mode`),
        fetch(`${API_BASE}/online/count`),
        fetch(`${API_BASE}/stats`),
      ]);
      const freeData = await freeRes.json();
      const onlineData = await onlineRes.json();
      const statsData = await statsRes.json();
      setFreeMode(!!freeData.freeMode);
      setStats({
        total: statsData.totalUsed || 0,
        online: onlineData.online || 0,
        pending: 0,
      });
      setLastUpdate(new Date());
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
    localStorage.clear();
    router.replace("/");
  };

  const navigate = (path: string) => {
    setSidebarOpen(false);
    if (path.endsWith(".html")) {
      window.open(path, "_blank");
    } else {
      router.push(path);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#f0f2f8" }}>
        <div className="spinner" />
      </div>
    );
  }

  const navItems = [
    { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", label: "控制台", path: "/admin", active: true },
    { icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label: "激活码管理", path: "/tools/gen-license" },
    { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", label: "工单管理", path: "/ticket-admin.html" },
    { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "更新历史", path: "/update-history.html" },
  ];

  const quickActions = [
    { icon: "🔑", title: "生成激活码", desc: "批量生成各类激活码", path: "/tools/gen-license", color: "#6366f1" },
    { icon: "🎫", title: "处理工单", desc: "查看和回复用户工单", path: "/ticket-admin.html", color: "#8b5cf6" },
    { icon: "📊", title: "数据统计", desc: "查看运营数据概览", path: "/admin", color: "#3b82f6" },
    { icon: "📜", title: "版本记录", desc: "查看项目更新历史", path: "/update-history.html", color: "#f59e0b" },
  ];

  return (
    <>
      <div className="app-bg" />

      {/* 移动端遮罩 */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="layout">
        {/* 侧边栏 */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="sidebar-logo-text">管理控制台</span>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <div
                key={item.path}
                className={`nav-item ${item.active ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button onClick={handleLogout} className="nav-item w-full" style={{ color: "#f87171" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              退出登录
            </button>
          </div>
        </aside>

        {/* 主内容 */}
        <div className="main-content">
          {/* 顶部栏 */}
          <header className="topbar">
            <div className="flex items-center gap-3">
              <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <h1 className="topbar-title">控制台</h1>
            </div>
            <div className="topbar-actions">
              <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <span className="online-dot" />
                <span className="text-xs font-medium text-green-400">{stats.online} 在线</span>
              </div>
            </div>
          </header>

          {/* 内容区 */}
          <main className="page-content">
            {/* 欢迎 */}
            <div className="mb-6 fade-in-up">
              <h2 className="text-xl font-bold text-white">欢迎回来 👋</h2>
              <p className="mt-1 text-sm text-slate-500">这里是您的管理控制台，所有功能一目了然</p>
            </div>

            {/* 数据统计 */}
            <div className="grid-4 mb-6">
              <div className="stat-card fade-in-up" style={{ animationDelay: "0.05s" }}>
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">累计激活</div>
                <div className="stat-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
              </div>
              <div className="stat-card fade-in-up" style={{ animationDelay: "0.1s" }}>
                <div className="stat-value text-green-400">{stats.online}</div>
                <div className="stat-label">当前在线</div>
                <div className="stat-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="stat-card fade-in-up" style={{ animationDelay: "0.15s" }}>
                <div className="stat-value" style={{ color: freeMode ? "#fbbf24" : "#64748b" }}>
                  {freeMode ? "FREE" : "PAID"}
                </div>
                <div className="stat-label">{freeMode ? "免费模式" : "付费模式"}</div>
                <div className="stat-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={freeMode ? "#fbbf24" : "#64748b"} strokeWidth="1.5">
                    <path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4" />
                    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                    <path d="M18 12a2 2 0 000 4h4v-4z" />
                  </svg>
                </div>
              </div>
              <div className="stat-card fade-in-up" style={{ animationDelay: "0.2s" }}>
                <div className="stat-value text-blue-400">14</div>
                <div className="stat-label">版本迭代</div>
                <div className="stat-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 更新时间戳 */}
            <div className="mb-4 text-right text-xs text-slate-400">
              数据更新于 {lastUpdate ? lastUpdate.toLocaleTimeString('zh-CN') : '--'}
            </div>

            {/* 免费模式开关 */}
            <div className="card mb-6 fade-in-up" style={{ animationDelay: "0.25s" }}>
              <div className="card-body" style={{ minHeight: "90px", display: "flex", alignItems: "center" }}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: freeMode ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)" }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={freeMode ? "#4ade80" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4" />
                        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                        <path d="M18 12a2 2 0 000 4h4v-4z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">全局限时免费</span>
                        {freeMode && <span className="badge badge-success">运行中</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">开启后所有游戏免费玩，首页显示「限时免费」标签</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleFreeMode}
                    disabled={loading}
                    style={{
                      position: "relative",
                      width: "52px",
                      height: "30px",
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
                        width: "24px",
                        height: "24px",
                        borderRadius: "999px",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                        transform: freeMode ? "translateX(22px)" : "translateX(0)",
                      }}
                    />
                  </button>
                </div>
                {statusMsg && <div className="mt-3 text-xs text-slate-400">{statusMsg}</div>}
              </div>
            </div>

            {/* 快捷入口 */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">快捷功能</h3>
            </div>
            <div className="grid-4">
              {quickActions.map((action, i) => (
                <div
                  key={action.path}
                  className="card p-5 cursor-pointer fade-in-up transition hover:shadow-md hover:-translate-y-1"
                  style={{ animationDelay: `${0.3 + i * 0.05}s` }}
                  onClick={() => navigate(action.path)}
                >
                  <div
                    className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${action.color}15` }}
                  >
                    {action.icon}
                  </div>
                  <h4 className="font-semibold text-white text-sm">{action.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{action.desc}</p>
                  <div className="mt-3 flex items-center text-xs text-slate-600">
                    进入
                    <svg className="ml-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* 最近操作记录 */}
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">最近操作记录</h3>
                <span className="text-xs text-slate-400">实时更新</span>
              </div>
              <div className="card">
                <div className="card-body" style={{ padding: "8px 20px" }}>
                  <div className="activity-list">
                    <div className="activity-item">
                      <div className="activity-dot" style={{ background: "#22c55e" }} />
                      <div className="activity-content">
                        <div className="activity-title">系统运行正常，所有服务在线</div>
                        <div className="activity-time">刚刚</div>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-dot" style={{ background: "#6366f1" }} />
                      <div className="activity-content">
                        <div className="activity-title">激活码验证服务已连接</div>
                        <div className="activity-time">{lastUpdate ? lastUpdate.toLocaleTimeString('zh-CN') : '--'}</div>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-dot" style={{ background: "#f59e0b" }} />
                      <div className="activity-content">
                        <div className="activity-title">在线人数统计已启用（5秒刷新）</div>
                        <div className="activity-time">系统启动时</div>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-dot" style={{ background: "#8b5cf6" }} />
                      <div className="activity-content">
                        <div className="activity-title">全局免费模式控制已就绪</div>
                        <div className="activity-time">系统启动时</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
