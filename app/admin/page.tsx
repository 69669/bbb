"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminHome() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("bbb_admin_authed") !== "true") {
      router.replace("/");
    } else {
      setAuthed(true);
    }
  }, [router]);

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

        {/* 功能卡片 */}
        <div className="grid gap-4 sm:grid-cols-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
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
            <div className="text-2xl font-bold text-white">2</div>
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
            <div className="text-2xl font-bold text-green-400">✓</div>
            <div className="mt-1 text-xs text-white/50">已登录</div>
          </div>
        </div>
      </div>
    </>
  );
}
