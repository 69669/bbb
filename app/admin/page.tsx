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
  const [toast, setToast] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stats, setStats] = useState({ total: 0, online: 0, pending: 0 });

  useEffect(() => {
    const loginTime = parseInt(localStorage.getItem("bbb_login_time") || "0");
    const expired = Date.now() - loginTime > 15 * 60 * 1000;
    if (localStorage.getItem("bbb_admin_authed") !== "true" || expired) {
      localStorage.clear();
      router.replace("/");
    } else {
      localStorage.setItem("bbb_login_time", String(Date.now()));
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
      setStats({ total: statsData.totalUsed || 0, online: onlineData.online || 0, pending: 0 });
      setLastUpdate(new Date());
    } catch (e) {}
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const toggleFreeMode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/config/free-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash: ADMIN_HASH, enabled: !freeMode }),
      });
      const data = await res.json();
      if (data.success) {
        setFreeMode(data.freeMode);
        showToast(data.freeMode ? "已开启限时免费" : "已关闭免费模式");
      } else {
        showToast(data.message || "操作失败");
      }
    } catch (e) {
      showToast("网络错误，请重试");
    }
    setLoading(false);
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
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)" }}><div style={{ width: "24px", height: "24px", border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /></div>;
  }

  const navItems = [
    { icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", label: "控制台", path: "/admin", active: true },
    { icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", label: "激活码管理", path: "/tools/gen-license" },
    { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", label: "工单管理", path: "/ticket-admin.html" },
    { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "更新历史", path: "/update-history.html" },
  ];

  const quickActions = [
    { title: "生成激活码", desc: "批量生成各类激活码", path: "/tools/gen-license", color: "#6366f1" },
    { title: "处理工单", desc: "查看和回复用户工单", path: "/ticket-admin.html", color: "#8b5cf6" },
    { title: "数据统计", desc: "查看运营数据概览", path: "/admin", color: "#3b82f6" },
    { title: "版本记录", desc: "查看项目更新历史", path: "/update-history.html", color: "#f59e0b" },
  ];

  const activities = [
    { title: "系统运行正常，所有服务在线", time: "刚刚", color: "#10b981" },
    { title: "激活码验证服务已连接", time: lastUpdate ? lastUpdate.toLocaleTimeString("zh-CN") : "--", color: "#6366f1" },
    { title: "在线人数统计已启用（15秒刷新）", time: "系统启动时", color: "#f59e0b" },
    { title: "全局免费模式控制已就绪", time: "系统启动时", color: "#8b5cf6" },
  ];

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <div className="sidebar-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <div className="sidebar-name">后台管理</div>
            <div className="sidebar-sub">管理控制台</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-label">主导航</div>
            {navItems.map((item) => (
              <div key={item.path} className={`nav-item ${item.active ? "active" : ""}`} onClick={() => navigate(item.path)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                {item.label}
              </div>
            ))}
          </div>
        </nav>
        <div className="sidebar-foot">
          <div className="nav-item" onClick={handleLogout}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            退出登录
          </div>
        </div>
      </aside>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h1 className="topbar-title">控制台</h1>
          </div>
          <div className="topbar-right">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: "var(--radius-full)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--success-text)" }}>{stats.online} 在线</span>
            </div>
          </div>
        </header>

        <main className="content">
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-900)", marginBottom: "6px" }}>欢迎回来</h2>
            <p style={{ fontSize: "14px", color: "var(--text-500)" }}>这里是您的管理控制台，所有功能一目了然</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card total">
              <div className="stat-icon" style={{ background: "var(--primary-bg)", color: "var(--primary)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
              </div>
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">累计激活</div>
            </div>
            <div className="stat-card resolved">
              <div className="stat-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div className="stat-num">{stats.online}</div>
              <div className="stat-label">当前在线</div>
            </div>
            <div className="stat-card pending">
              <div className="stat-icon" style={{ background: freeMode ? "var(--success-bg)" : "var(--bg-hover)", color: freeMode ? "var(--success)" : "var(--text-500)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>
              </div>
              <div className="stat-num" style={{ fontSize: "var(--font-2xl)" }}>{freeMode ? "FREE" : "PAID"}</div>
              <div className="stat-label">运行模式</div>
            </div>
            <div className="stat-card processing">
              <div className="stat-icon" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="stat-num" style={{ fontSize: "var(--font-2xl)" }}>v10.0</div>
              <div className="stat-label">版本迭代</div>
            </div>
          </div>

          <div style={{ textAlign: "right", fontSize: "12px", color: "var(--text-400)", marginBottom: "16px" }}>
            数据更新于 {lastUpdate ? lastUpdate.toLocaleTimeString("zh-CN") : "--"}
          </div>

          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", minHeight: "72px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", background: freeMode ? "var(--success-bg)" : "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", color: freeMode ? "var(--success)" : "var(--text-500)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-900)" }}>全局限时免费</span>
                    {freeMode && <span className="badge badge-success">运行中</span>}
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-500)", marginTop: "2px" }}>开启后所有游戏免费玩，首页显示「限时免费」标签</p>
                </div>
              </div>
              <button onClick={toggleFreeMode} disabled={loading}
                style={{ position: "relative", width: "52px", height: "30px", borderRadius: "999px", cursor: loading ? "not-allowed" : "pointer", background: freeMode ? "var(--success)" : "var(--text-300)", transition: "background 0.3s", opacity: loading ? 0.5 : 1, flexShrink: 0 }}>
                <span style={{ position: "absolute", top: "3px", left: "3px", width: "24px", height: "24px", borderRadius: "999px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)", transform: freeMode ? "translateX(22px)" : "translateX(0)" }} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-500)", textTransform: "uppercase", letterSpacing: "0.8px" }}>快捷功能</h3>
          </div>
          <div className="stats-grid">
            {quickActions.map((action, i) => (
              <div key={i} className="card" style={{ padding: "20px", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => navigate(action.path)}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "var(--primary-border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "var(--radius-md)", background: `${action.color}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={action.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {i === 0 && <><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></>}
                    {i === 1 && <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></>}
                    {i === 2 && <><path d="M18 20V10M12 20V4M6 20v-6"/></>}
                    {i === 3 && <><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></>}
                  </svg>
                </div>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-900)", marginBottom: "4px" }}>{action.title}</h4>
                <p style={{ fontSize: "12px", color: "var(--text-400)", marginBottom: "10px" }}>{action.desc}</p>
                <div style={{ display: "flex", alignItems: "center", fontSize: "12px", color: action.color, fontWeight: 500 }}>
                  进入
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "4px" }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-500)", textTransform: "uppercase", letterSpacing: "0.8px" }}>最近操作记录</h3>
              <span style={{ fontSize: "12px", color: "var(--text-400)" }}>实时更新</span>
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: "8px 20px" }}>
                {activities.map((act, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: i < activities.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: act.color, flexShrink: 0, boxShadow: `0 0 6px ${act.color}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", color: "var(--text-700)", fontWeight: 500 }}>{act.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-400)", marginTop: "2px" }}>{act.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
