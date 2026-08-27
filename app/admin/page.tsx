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

  useEffect(() => {
    if (localStorage.getItem("bbb_admin_authed") !== "true") {
      router.replace("/");
    } else {
      setAuthed(true);
      fetchFreeMode();
    }
  }, [router]);

  const fetchFreeMode = async () => {
    try {
      const res = await fetch(`${API_BASE}/config/free-mode`);
      const data = await res.json();
      setFreeMode(!!data.freeMode);
    } catch (e) {
      console.error("获取免费模式状态失败", e);
    }
  };

  const toggleFreeMode = async () => {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch(`${API_BASE}/config/free-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passwordHash: ADMIN_HASH,
          enabled: !freeMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFreeMode(data.freeMode);
        setStatusMsg(data.freeMode ? "✅ 已开启限时免费，所有游戏免费玩" : "✅ 已关闭免费模式，恢复付费");
      } else {
        setStatusMsg("❌ " + (data.message || "操作失败"));
      }
    } catch (e) {
      setStatusMsg("❌ 网络错误，请重试");
    }
    setLoading(false);
    setTimeout(() => setStatusMsg(""), 3000);
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white/40">加载中...</div>
      </div>
    );
  }

  const menuItems = [
    {
      icon: "🔑",
      title: "激活码管理",
      desc: "生成、管理、导出激活码",
      path: "/tools/gen-license",
      color: "from-pink-500 to-rose-500",
      bgColor: "bg-pink-500/10",
      borderColor: "border-pink-500/30",
    },
    {
      icon: "🎫",
      title: "工单管理",
      desc: "处理用户反馈和工单",
      path: "/ticket-admin.html",
      color: "from-purple-500 to-blue-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
    },
    {
      icon: "📜",
      title: "更新历史",
      desc: "查看项目版本更新记录",
      path: "/update-history.html",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    },
  ];

  return (
    <>
      <div className="bg-aurora" />
      <div className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
        {/* 顶部栏 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">🎛️ 后台管理</h1>
            <p className="mt-1 text-sm text-white/50">选择功能模块</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 transition"
          >
            退出登录
          </button>
        </div>

        {/* 全局免费模式开关 */}
        <div
          className={`mb-8 rounded-2xl border p-6 transition-all ${
            freeMode
              ? "border-green-500/40 bg-green-500/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎁</span>
                <h2 className="text-lg font-bold text-white">全局限时免费</h2>
                {freeMode && (
                  <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    已开启
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-white/50">
                开启后所有游戏免费玩，首页显示「限时免费」标签；关闭后恢复付费激活
              </p>
            </div>
            <button
              onClick={toggleFreeMode}
              disabled={loading}
              style={{
                position: 'relative',
                width: '64px',
                height: '32px',
                borderRadius: '9999px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: freeMode ? '#22c55e' : 'rgba(255,255,255,0.2)',
                transition: 'background 0.3s',
                opacity: loading ? 0.5 : 1,
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '9999px',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'transform 0.3s',
                  transform: freeMode ? 'translateX(32px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>
          {statusMsg && (
            <div className="mt-3 text-sm text-white/70">{statusMsg}</div>
          )}
        </div>

        {/* 功能卡片 */}
        <div className="grid gap-4 sm:grid-cols-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                if (item.path.endsWith('.html')) {
                  window.open(item.path, '_blank');
                } else {
                  router.push(item.path);
                }
              }}
              className={`group relative overflow-hidden rounded-2xl border ${item.borderColor} ${item.bgColor} p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl`}
            >
              <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${item.color} opacity-20 blur-xl transition group-hover:opacity-40`} />
              <div className="relative">
                <div className="mb-4 text-4xl">{item.icon}</div>
                <h2 className="text-xl font-bold text-white">{item.title}</h2>
                <p className="mt-2 text-sm text-white/60">{item.desc}</p>
                <div className="mt-4 flex items-center text-sm text-white/40 group-hover:text-white/70 transition">
                  进入 <span className="ml-1">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 统计信息 */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-2xl font-bold text-white">3</div>
            <div className="mt-1 text-xs text-white/50">功能模块</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-2xl font-bold text-pink-400">6</div>
            <div className="mt-1 text-xs text-white/50">卡类型</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">7</div>
            <div className="mt-1 text-xs text-white/50">工单模块</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <div className={`text-2xl font-bold ${freeMode ? "text-green-400" : "text-white/40"}`}>
              {freeMode ? "FREE" : "✓"}
            </div>
            <div className="mt-1 text-xs text-white/50">{freeMode ? "免费中" : "已登录"}</div>
          </div>
        </div>
      </div>
    </>
  );
}
