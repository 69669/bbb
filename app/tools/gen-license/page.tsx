"use client";
import Link from "next/link";
import React from "react";
import { TYPE_NAMES } from "../../../lib/license";

// Cloudflare Worker API 地址（用于查询激活码真实使用状态）
const API_BASE_URL = "https://api.ttla.top";

// 密码哈希（非明文存储，修改密码需重新计算哈希值）
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ADMIN_PASSWORD_HASH = 535441809;

interface HistoryItem {
  code: string;
  type: number;
  createdAt: number;
  used: boolean;
}

export default class GeneratePage extends React.Component {
  constructor(props: {}) {
    super(props);
    this.state = {
      type: 3,
      count: 1,
      codes: [] as string[],
      copied: false,
      authenticated: false,
      password: "",
      error: "",
      history: [] as HistoryItem[],
      showHistory: false,
      filterType: 0, // 0=全部
      checking: false, // 是否正在从云端查询状态
      adminPassword: "", // 管理密码（用于调用Worker生成接口）
      generating: false, // 是否正在生成
    };
  }

  state: {
    type: number;
    count: number;
    codes: string[];
    copied: boolean;
    authenticated: boolean;
    password: string;
    error: string;
    history: HistoryItem[];
    showHistory: boolean;
    filterType: number;
    checking: boolean;
    adminPassword: string;
    generating: boolean;
  };

  componentDidMount() {
    if (typeof window !== "undefined") {
      const auth = localStorage.getItem("lg_admin_auth");
      if (auth === "1") {
        this.setState({ authenticated: true });
      }
      const historyData = localStorage.getItem("lg_gen_history");
      if (historyData) {
        try {
          this.setState({ history: JSON.parse(historyData) });
        } catch {}
      }
    }
  }

  saveHistory = (history: HistoryItem[]) => {
    localStorage.setItem("lg_gen_history", JSON.stringify(history));
    this.setState({ history });
  };

  handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { password } = this.state;
    if (simpleHash(password) === ADMIN_PASSWORD_HASH) {
      localStorage.setItem("lg_admin_auth", "1");
      localStorage.setItem("lg_admin_hash", String(simpleHash(password)));
      this.setState({ authenticated: true, password: "", error: "", adminPassword: password });
    } else {
      this.setState({ error: "密码错误，请重试" });
    }
  };

  handleLogout = () => {
    localStorage.removeItem("lg_admin_auth");
    localStorage.removeItem("lg_admin_hash");
    this.setState({ authenticated: false });
  };

  handleGenerate = async () => {
    const { type, count, history, adminPassword } = this.state;
    this.setState({ generating: true });
    try {
      const res = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, count, passwordHash: localStorage.getItem("lg_admin_hash") || "" }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) {
        alert("生成失败：Worker版本过旧，缺少/generate接口，请重新部署最新版Worker");
        this.setState({ generating: false });
        return;
      }
      if (res.status === 403) {
        alert("生成失败：管理密码错误，请退出重新登录");
        this.setState({ generating: false });
        return;
      }
      if (!res.ok) {
        alert(`生成失败：Worker返回错误 HTTP ${res.status}`);
        this.setState({ generating: false });
        return;
      }
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "生成失败");
        this.setState({ generating: false });
        return;
      }
      const newCodes: string[] = data.codes;
      const newHistory: HistoryItem[] = [...history];
      for (const code of newCodes) {
        newHistory.unshift({
          code,
          type,
          createdAt: Date.now(),
          used: false,
        });
      }
      this.saveHistory(newHistory);
      this.setState({ codes: newCodes, copied: false, generating: false });
    } catch (e: any) {
      if (e?.name === "TimeoutError") {
        alert("生成失败：请求超时（15秒），请检查网络或Worker状态");
      } else {
        alert("生成失败：网络错误 - " + (e?.message || String(e)) + "\n请检查Worker是否正常部署，api.ttla.top是否可访问");
      }
      this.setState({ generating: false });
    }
  };

  handleCopy = async () => {
    const text = this.state.codes.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  handleDownload = () => {
    const text = this.state.codes.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `激活码_${TYPE_NAMES[this.state.type]}_${this.state.codes.length}个.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  toggleUsed = (index: number) => {
    const { history } = this.state;
    const newHistory = [...history];
    newHistory[index] = { ...newHistory[index], used: !newHistory[index].used };
    this.saveHistory(newHistory);
  };

  deleteHistory = (index: number) => {
    const { history } = this.state;
    const newHistory = history.filter((_, i) => i !== index);
    this.saveHistory(newHistory);
  };

  clearHistory = () => {
    if (confirm("确定要清空所有生成记录吗？")) {
      this.saveHistory([]);
    }
  };

  exportHistory = () => {
    const { history, filterType } = this.state;
    // 按当前筛选导出
    const filtered = filterType === 0 ? history : history.filter((h) => h.type === filterType);
    if (filtered.length === 0) {
      alert("没有可导出的记录");
      return;
    }
    // 按类型分组
    const grouped: Record<number, HistoryItem[]> = {};
    for (const item of filtered) {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item);
    }
    // 生成文本，按类型分类
    let text = "";
    for (const typeStr of Object.keys(grouped).sort()) {
      const type = parseInt(typeStr);
      const items = grouped[type];
      text += `========== ${TYPE_NAMES[type]} (${items.length}个) ==========\n`;
      for (const h of items) {
        const date = new Date(h.createdAt).toLocaleString("zh-CN");
        const status = h.used ? "已使用" : "未使用";
        text += `${h.code}\t${date}\t${status}\n`;
      }
      text += "\n";
    }
    const typeLabel = filterType === 0 ? "全部" : TYPE_NAMES[filterType];
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `激活码_${typeLabel}_${new Date().toLocaleDateString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 批量复制当前筛选的所有未使用激活码
  copyAllUnused = () => {
    const { history, filterType } = this.state;
    const filtered = filterType === 0 ? history : history.filter((h) => h.type === filterType);
    const unused = filtered.filter((h) => !h.used);
    if (unused.length === 0) {
      alert("没有未使用的激活码");
      return;
    }
    const text = unused.map((h) => h.code).join("\n");
    this.copyToClipboard(text);
    alert(`已复制 ${unused.length} 个未使用激活码`);
  };

  copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      });
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // 从云端查询单个激活码的使用状态
  checkCodeFromCloud = async (code: string): Promise<boolean | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/check?code=${encodeURIComponent(code)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        return !!data.used;
      }
      return null;
    } catch {
      return null;
    }
  };

  // 从云端刷新所有历史记录的使用状态
  refreshAllStatus = async () => {
    const { history } = this.state;
    if (history.length === 0) return;
    this.setState({ checking: true });
    const newHistory = [...history];
    let updated = 0;
    for (let i = 0; i < newHistory.length; i++) {
      const cloudUsed = await this.checkCodeFromCloud(newHistory[i].code);
      if (cloudUsed !== null && cloudUsed !== newHistory[i].used) {
        newHistory[i] = { ...newHistory[i], used: cloudUsed };
        updated++;
      }
    }
    localStorage.setItem("lg_gen_history", JSON.stringify(newHistory));
    this.setState({ history: newHistory, checking: false });
    if (updated > 0) {
      alert(`已从云端同步状态，更新了 ${updated} 条记录`);
    } else {
      alert("云端状态同步完成，所有记录状态已是最新");
    }
  };

  render() {
    const { type, count, codes, copied, authenticated, password, error, history, showHistory, filterType, checking, generating } = this.state;

    if (!authenticated) {
      return (
        <>
          <div className="bg-aurora" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-8">
            <div className="game-container">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🔐</div>
                <h1 className="text-xl font-bold text-white">验证身份</h1>
                <p className="mt-2 text-sm text-white/50">请输入管理密码</p>
              </div>
              <form onSubmit={this.handlePasswordSubmit} className="space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => this.setState({ password: e.target.value, error: "" })}
                  placeholder="输入密码"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/50"
                  autoFocus
                />
                {error && (
                  <div className="rounded-lg bg-red-500/10 p-2 text-center text-sm text-red-300">{error}</div>
                )}
                <button type="submit" className="w-full rounded-full bg-pink-500 py-3 text-base font-semibold text-white shadow-lg shadow-pink-500/40 hover:bg-pink-400 transition">
                  验证
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link href="/" className="text-xs text-white/40 hover:text-white/60">返回首页</Link>
              </div>
            </div>
          </div>
        </>
      );
    }

    const typeOptions = [
      { value: 1, label: "周卡", desc: "7天" },
      { value: 2, label: "月卡", desc: "30天" },
      { value: 3, label: "季卡", desc: "90天" },
      { value: 4, label: "年卡", desc: "365天" },
    ];

    const filteredHistory = filterType === 0 ? history : history.filter((h) => h.type === filterType);
    const usedCount = history.filter((h) => h.used).length;

    return (
      <>
        <div className="bg-aurora" />
        <div className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="back-btn inline-flex">← 返回首页</Link>
            <div className="flex gap-2">
              <button onClick={() => this.setState({ showHistory: !showHistory })} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                {showHistory ? "返回生成" : `📋 记录(${history.length})`}
              </button>
              <button onClick={this.handleLogout} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 transition">
                退出
              </button>
            </div>
          </div>

          {!showHistory ? (
            <div className="game-container">
              <div className="text-center mb-6">
                <h1 className="game-title">激活码生成器</h1>
                <div className="game-title-underline" />
                <p className="mt-3 text-sm text-white/60">生成周卡 / 月卡 / 季卡 / 年卡激活码</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-white/70 mb-3">选择卡类型</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {typeOptions.map((opt) => (
                    <button key={opt.value} onClick={() => this.setState({ type: opt.value })}
                      className={`rounded-xl border p-3 text-center transition ${type === opt.value ? "border-pink-400/60 bg-pink-500/20 ring-2 ring-pink-400/30" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                      <div className="text-base font-semibold">{opt.label}</div>
                      <div className="text-xs text-white/50 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-white/70 mb-2">生成数量：{count} 个</label>
                <input type="range" min="1" max="300" value={count} onChange={(e) => this.setState({ count: parseInt(e.target.value) })} className="w-full accent-pink-500" />
                <div className="flex justify-between text-xs text-white/40 mt-1"><span>1</span><span>300</span></div>
              </div>

              <button onClick={this.handleGenerate} disabled={generating} className="w-full rounded-full bg-pink-500 py-3 text-base font-semibold text-white shadow-lg shadow-pink-500/40 hover:bg-pink-400 transition mb-6 disabled:opacity-50 disabled:cursor-not-allowed">
                {generating ? "⏳ 生成中..." : "🎫 生成激活码"}
              </button>

              {codes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">已生成 {codes.length} 个{TYPE_NAMES[type]}</span>
                    <div className="flex gap-2">
                      <button onClick={this.handleCopy} className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 transition">
                        {copied ? "✓ 已复制" : "复制全部"}
                      </button>
                      <button onClick={this.handleDownload} className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 transition">
                        下载TXT
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="space-y-2">
                      {codes.map((code, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                          <span className="font-mono text-sm text-pink-200">{code}</span>
                          <button onClick={() => this.handleCopyCode(code)} className="text-xs text-white/40 hover:text-white/70">复制</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="game-container">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">📋 生成记录</h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={this.copyAllUnused} className="rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/20 transition">复制未使用</button>
                  <button onClick={this.exportHistory} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition">导出{filterType === 0 ? "全部" : TYPE_NAMES[filterType]}</button>
                  <button onClick={this.clearHistory} className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition">清空</button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white/60">共 {history.length} 条</span>
                  <span className="text-green-400">已用 {usedCount}</span>
                  <span className="text-yellow-400">未用 {history.length - usedCount}</span>
                </div>
                <button
                  onClick={this.refreshAllStatus}
                  disabled={checking}
                  className="shrink-0 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50"
                >
                  {checking ? "⏳ 查询中..." : "🔄 刷新云端状态"}
                </button>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={() => this.setState({ filterType: 0 })} className={`rounded-full px-3 py-1 text-xs transition ${filterType === 0 ? "bg-pink-500 text-white" : "bg-white/5 text-white/60"}`}>全部</button>
                {typeOptions.map((opt) => (
                  <button key={opt.value} onClick={() => this.setState({ filterType: opt.value })} className={`rounded-full px-3 py-1 text-xs transition ${filterType === opt.value ? "bg-pink-500 text-white" : "bg-white/5 text-white/60"}`}>{opt.label}</button>
                ))}
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-white/40">暂无记录</div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredHistory.map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${item.used ? "border-green-400/20 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-pink-200 truncate">{item.code}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                          <span>{TYPE_NAMES[item.type]}</span>
                          <span>·</span>
                          <span>{this.formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                      <button onClick={() => this.toggleUsed(i)} className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${item.used ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {item.used ? "✓ 已用" : "未用"}
                      </button>
                      <button onClick={() => this.handleCopyCode(item.code)} className="shrink-0 text-xs text-white/40 hover:text-white/70 px-2">复制</button>
                      <button onClick={() => this.deleteHistory(i)} className="shrink-0 text-xs text-red-400/60 hover:text-red-400 px-2">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }
}
