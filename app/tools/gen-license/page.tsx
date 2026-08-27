"use client";
import Link from "next/link";
import React from "react";

// Cloudflare Worker API 地址（用于查询激活码真实使用状态）
const API_BASE_URL = "https://api.ttla.top";

// 卡类型名称
const TYPE_NAMES: Record<number, string> = {
  0: "天卡",
  1: "周卡",
  2: "月卡",
  3: "季卡",
  4: "年卡",
  5: "测试卡",
};

// 密码哈希（非明文存储，修改密码需重新计算哈希值）
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
// 清理激活码：去掉横线和空格，转大写
function cleanCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const ADMIN_PASSWORD_HASH = 535441809;

interface HistoryItem {
  code: string;
  type: number;
  createdAt: number;
  used: boolean;
  disabled?: boolean;
  usedAt?: number | null;
  usedIp?: string | null;
  generatedIp?: string | null;
  disabledAt?: number | null;
  disabledReason?: string | null;
}

export default class GeneratePage extends React.Component {
  constructor(props: {}) {
    super(props);
    this.state = {
      type: 0,
      count: 1,
      codes: [] as string[],
      copied: false,
      authenticated: false,
      password: "",
      error: "",
      history: [] as HistoryItem[],
      showHistory: false,
      filterType: -1, // -1=全部
      checking: false, // 是否正在从云端查询状态
      adminPassword: "", // 管理密码（用于调用Worker生成接口）
      generating: false, // 是否正在生成
      progress: 0, // 生成进度（已完成数量）
      totalCount: 0, // 总生成数量
      syncing: false, // 是否正在从云端同步
      lastRefresh: "", // 最后刷新时间
      disabling: false, // 是否正在禁用/启用
      showDetail: null as number | null, // 当前查看详情的索引
      toast: "", // 提示信息
      statusFilter: 0, // 0=全部, 1=未激活, 2=已激活, 3=已禁用
      search: "", // 搜索关键词
      currentPage: 1, // 当前页码
      pageSize: 50, // 每页50条
    };
    this.autoRefreshTimer = null as any;
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
    progress: number;
    totalCount: number;
    syncing: boolean;
    lastRefresh: string;
    disabling: boolean;
    showDetail: number | null;
    toast: string;
    statusFilter: number;
    search: string;
    currentPage: number;
    pageSize: number;
  };
  autoRefreshTimer: any;

  componentDidMount() {
    if (typeof window !== "undefined") {
      // 统一登录：检查bbb后台登录状态
      const bbbAuthed = localStorage.getItem("bbb_admin_authed");
      if (bbbAuthed === "true") {
        this.setState({ authenticated: true, adminPassword: "" });
        // 兼容旧的lg_admin_auth
        localStorage.setItem("lg_admin_auth", "1");
        if (!localStorage.getItem("lg_admin_hash")) {
          localStorage.setItem("lg_admin_hash", "535441809");
        }
        setTimeout(() => this.syncFromCloud(), 300);
        this.startAutoRefresh();
      } else {
        // 未登录，跳回登录页
        window.location.href = "/";
        return;
      }
      const historyData = localStorage.getItem("lg_gen_history");
      if (historyData) {
        try {
          this.setState({ history: JSON.parse(historyData) });
        } catch {}
      }
    }
  }

  // 启动自动刷新
  startAutoRefresh = () => {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = setInterval(() => {
      // 静默刷新（不显示loading，不弹窗提示）
      this.silentRefreshStatus();
    }, 30000); // 每30秒刷新一次
  };

  // 静默刷新云端状态（不弹窗）
  silentRefreshStatus = async () => {
    const { history } = this.state;
    if (history.length === 0) return;
    try {
      const newHistory = [...history];
      // 并发检测，每批20个
      const BATCH_SIZE = 30;
      for (let i = 0; i < newHistory.length; i += BATCH_SIZE) {
        const batch = newHistory.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((item) => this.checkCodeFromCloud(cleanCode(item.code)))
        );
        results.forEach((cloudUsed, idx) => {
          const globalIdx = i + idx;
          if (cloudUsed !== null && cloudUsed !== newHistory[globalIdx].used) {
            newHistory[globalIdx] = { ...newHistory[globalIdx], used: cloudUsed };
          }
        });
      }
      localStorage.setItem("lg_gen_history", JSON.stringify(newHistory));
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      this.setState({ history: newHistory, lastRefresh: timeStr });
    } catch {}
  };

  // 页面卸载时清除定时器
  componentWillUnmount() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
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
      // 登录成功后启动自动刷新
      setTimeout(() => this.startAutoRefresh(), 500);
    } else {
      this.setState({ error: "密码错误，请重试" });
    }
  };

  handleLogout = () => {
    localStorage.removeItem("lg_admin_auth");
    localStorage.removeItem("lg_admin_hash");
    localStorage.removeItem("bbb_admin_authed");
    localStorage.removeItem("bbb_admin_hash");
    window.location.href = "/";
  };

  handleGenerate = async () => {
    const { type, count, history } = this.state;
    const BATCH_SIZE = 10; // 每批生成10个，避免Worker超时
    const allCodes: string[] = [];
    const newHistory: HistoryItem[] = [...history];
    let completed = 0;

    this.setState({ generating: true, progress: 0, totalCount: count });

    try {
      // 分批生成
      while (completed < count) {
        const batchCount = Math.min(BATCH_SIZE, count - completed);
        const res = await fetch(`${API_BASE_URL}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, count: batchCount, passwordHash: localStorage.getItem("lg_admin_hash") || "" }),
          signal: AbortSignal.timeout(120000),
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

        // 收集这批生成的码
        for (const code of data.codes) {
          const clean = cleanCode(code);
          allCodes.push(clean);
          newHistory.unshift({
            code: clean,
            type,
            createdAt: Date.now(),
            used: false,
          });
        }

        completed += batchCount;
        this.setState({ progress: completed });
      }

      // 全部生成完成，保存历史
      this.saveHistory(newHistory);
      this.setState({ codes: allCodes, copied: false, generating: false, progress: 0, totalCount: 0 });
    } catch (e: any) {
      if (e?.name === "TimeoutError") {
        alert(`生成失败：请求超时，已生成 ${completed}/${count} 个。已生成的码已保存，请减少数量重试。`);
      } else {
        alert(`生成失败：网络错误 - ${e?.message || String(e)}。已生成 ${completed}/${count} 个，已生成的码已保存。`);
      }
      // 即使失败，也保存已生成的码
      if (allCodes.length > 0) {
        this.saveHistory(newHistory);
        this.setState({ codes: allCodes, copied: false });
      }
      this.setState({ generating: false, progress: 0, totalCount: 0 });
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
      this.showToast("✓ 已复制");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      this.showToast("✓ 已复制");
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
    if (!confirm("确定要删除此激活码吗？删除后云端也会同步删除，无法恢复！")) return;
    const { history } = this.state;
    const item = history[index];
    if (!item) return;
    // 先从本地删除（立即消失）
    const newHistory = history.filter((_, i) => i !== index);
    this.saveHistory(newHistory);
    this.showToast("✓ 已删除");
    // 异步从云端删除（不等待）
    fetch(`${API_BASE_URL}/codes/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: cleanCode(item.code),
        passwordHash: localStorage.getItem("lg_admin_hash") || "",
      }),
    }).catch(() => {});
  };

  clearHistory = () => {
    if (confirm("确定要清空所有生成记录吗？")) {
      this.saveHistory([]);
    }
  };

  exportHistory = () => {
    const { history, filterType } = this.state;
    // 按当前筛选导出
    const filtered = filterType === -1 ? history : history.filter((h) => h.type === filterType);
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
    const typeLabel = filterType === -1 ? "全部" : TYPE_NAMES[filterType];
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
    const filtered = filterType === -1 ? history : history.filter((h) => h.type === filterType);
    const unused = filtered.filter((h) => !h.used);
    if (unused.length === 0) {
      alert("没有未使用的激活码");
      return;
    }
    const text = unused.map((h) => h.code).join("\n");
    this.copyToClipboard(text);
    this.showToast(`✓ 已复制 ${unused.length} 个未使用激活码`);
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

  // 从云端刷新所有历史记录的使用状态（批量查询，快速）
  refreshAllStatus = async () => {
    const { history } = this.state;
    if (history.length === 0) {
      this.showToast("暂无记录可查询");
      return;
    }
    this.setState({ checking: true });
    try {
      const newHistory = [...history];
      let updated = 0;
      let failed = 0;
      // 批量查询，每批20个，用Promise.all并发
      const batchSize = 20;
      for (let i = 0; i < newHistory.length; i += batchSize) {
        const batch = newHistory.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((item) => this.checkCodeFromCloud(cleanCode(item.code)))
        );
        results.forEach((cloudUsed, idx) => {
          const globalIdx = i + idx;
          if (cloudUsed === null) {
            failed++;
          } else if (cloudUsed !== newHistory[globalIdx].used) {
            newHistory[globalIdx] = { ...newHistory[globalIdx], used: cloudUsed };
            updated++;
          }
        });
      }
      localStorage.setItem("lg_gen_history", JSON.stringify(newHistory));
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      this.setState({ history: newHistory, lastRefresh: timeStr });
      // 明确的成功/失败提示
      if (failed > 0 && updated > 0) {
        this.showToast(`✓ 同步${updated}条，${failed}条查询失败`);
      } else if (failed > 0) {
        this.showToast(`⚠️ ${failed}条查询失败，请检查网络`);
      } else if (updated > 0) {
        this.showToast(`✓ 刷新成功，已同步${updated}条状态`);
      } else {
        this.showToast("✓ 刷新成功，已是最新状态");
      }
    } catch (e) {
      this.showToast("❌ 刷新失败，请检查网络后重试");
    } finally {
      this.setState({ checking: false });
    }
  };

  // 从云端同步所有生成记录（电脑手机通用）
  syncFromCloud = async () => {
    this.setState({ syncing: true });
    try {
      const res = await fetch(`${API_BASE_URL}/codes/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash: localStorage.getItem("lg_admin_hash") || "" }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) {
        this.setState({ syncing: false });
        return;
      }
      const data = await res.json();
      if (!data.success) {
        this.setState({ syncing: false });
        return;
      }
      // 合并云端记录到本地（去重）
      const { history } = this.state;
      const localCodes = new Set(history.map((h) => cleanCode(h.code)));
      const newHistory = [...history];
      let added = 0;
      for (const item of data.codes) {
        const clean = cleanCode(item.code);
        if (!localCodes.has(clean)) {
          const clean = cleanCode(item.code);
          // 检查是否已存在（去重）
          if (!localCodes.has(clean)) {
            newHistory.unshift({
              code: clean,
              type: item.type,
              createdAt: item.generatedAt,
              used: item.used,
              disabled: item.disabled || false,
              usedAt: item.usedAt || null,
              usedIp: item.usedIp || null,
              generatedIp: item.generatedIp || null,
              disabledAt: item.disabledAt || null,
              disabledReason: item.disabledReason || null,
            });
            added++;
          }
          added++;
        } else {
          // 更新本地记录的使用状态和其他字段
          const idx = newHistory.findIndex((h) => cleanCode(h.code) === clean);
          if (idx >= 0) {
            newHistory[idx] = {
              ...newHistory[idx],
              code: clean, // 统一为无横线格式
              used: item.used,
              disabled: item.disabled || false,
              usedAt: item.usedAt || null,
              usedIp: item.usedIp || null,
              generatedIp: item.generatedIp || null,
              disabledAt: item.disabledAt || null,
              disabledReason: item.disabledReason || null,
            };
          }
        }
      }
      // 按生成时间倒序
      newHistory.sort((a, b) => b.createdAt - a.createdAt);
      localStorage.setItem("lg_gen_history", JSON.stringify(newHistory));
      this.setState({ history: newHistory, syncing: false });
      // 显示同步结果
      if (added > 0) {
        alert(`云端同步完成：新增 ${added} 条记录，当前共 ${newHistory.length} 条`);
      } else {
        alert(`云端同步完成：没有新增记录，当前共 ${newHistory.length} 条`);
      }
    } catch (e: any) {
      this.setState({ syncing: false });
      alert(`云端同步失败：${e?.message || String(e)}
请检查Worker是否已部署最新版本，或网络是否正常`);
    }
  };

  // 禁用激活码
  disableCode = async (index: number) => {
    const { history } = this.state;
    const item = history[index];
    if (!item) return;
    const reason = prompt("请输入封禁原因（可选）：", "管理员封禁");
    if (reason === null) return;
    this.setState({ disabling: true });
    try {
      const res = await fetch(`${API_BASE_URL}/codes/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode(item.code),
          reason: reason || "管理员封禁",
          passwordHash: localStorage.getItem("lg_admin_hash") || "",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (data.success) {
        const newHistory = [...history];
        newHistory[index] = { ...newHistory[index], disabled: true, disabledAt: Date.now(), disabledReason: reason || "管理员封禁" };
        this.saveHistory(newHistory);
        this.showToast("✓ 已封禁");
      } else {
        this.showToast("封禁失败：" + (data.message || "未知错误"));
      }
    } catch (e: any) {
      this.showToast("封禁失败：" + (e?.message || String(e)));
    }
    this.setState({ disabling: false });
  };
  // 启用激活码
  enableCode = async (index: number) => {
    const { history } = this.state;
    const item = history[index];
    if (!item) return;
    if (!confirm("确定要启用此激活码吗？")) return;
    this.setState({ disabling: true });
    try {
      const res = await fetch(`${API_BASE_URL}/codes/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode(item.code),
          passwordHash: localStorage.getItem("lg_admin_hash") || "",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (data.success) {
        const newHistory = [...history];
        newHistory[index] = { ...newHistory[index], disabled: false, disabledAt: null, disabledReason: null };
        this.saveHistory(newHistory);
        this.showToast("✓ 已解封");
      } else {
        this.showToast("解封失败：" + (data.message || "未知错误"));
      }
    } catch (e: any) {
      this.showToast("解封失败：" + (e?.message || String(e)));
    }
    this.setState({ disabling: false });
  };
  // 格式化IP（显示完整）
  formatIp = (ip: string | null | undefined): string => {
    if (!ip || ip === "unknown") return "未知";
    return ip;
  };
  // 格式化完整时间
  formatFullDate = (timestamp: number | null | undefined): string => {
    if (!timestamp) return "未激活";
    const d = new Date(timestamp);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };
  // 显示提示
  showToast = (msg: string) => {
    this.setState({ toast: msg });
    setTimeout(() => this.setState({ toast: "" }), 2000);
  };
  // 清空云端所有激活码记录
  clearCloud = async () => {
    if (!confirm("⚠️ 确定要清空云端所有激活码记录吗？\n\n此操作不可恢复！清空后：\n1. 之前生成的所有激活码全部失效\n2. 云端记录全部删除\n3. 本地记录也会同步清空\n\n确定继续吗？")) {
      return;
    }
    if (!confirm("再次确认：真的要清空所有激活码吗？此操作不可恢复！")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/codes/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash: localStorage.getItem("lg_admin_hash") || "" }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem("lg_gen_history");
        this.setState({ history: [] });
        alert(`云端记录已清空，共删除 ${data.deleted} 条激活码`);
      } else {
        alert("清空失败：" + (data.message || "未知错误"));
      }
    } catch (e: any) {
      let msg = e?.message || String(e);
      if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
        msg = "网络请求失败，请检查：\n1. Worker是否已部署最新版本（含/codes/clear接口）\n2. api.ttla.top是否可正常访问\n3. 网络连接是否正常";
      }
      alert("清空失败：" + msg);
    }
  };

  render() {
    const { type, count, codes, copied, authenticated, password, error, history, showHistory, filterType, checking, generating, progress, totalCount, syncing, disabling, showDetail, statusFilter, search, currentPage, pageSize } = this.state;

    const { toast } = this.state;
    if (!authenticated) {
      return (
        <>
          <div className="bg-aurora" />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-8">
            <div className="glass-card">
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
                  className="input-field text-center"
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
          {toast && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/80 px-6 py-3 text-sm text-white shadow-lg backdrop-blur-sm animate-fade-in">
              {toast}
            </div>
          )}
        </>
      );
    }

    const typeOptions = [
      { value: 0, label: "天卡", desc: "1天" },
      { value: 5, label: "测试卡", desc: "5分钟" },
      { value: 1, label: "周卡", desc: "7天" },
      { value: 2, label: "月卡", desc: "30天" },
      { value: 3, label: "季卡", desc: "90天" },
      { value: 4, label: "年卡", desc: "365天" },
    ];

    let filteredHistory = filterType === -1 ? history : history.filter((h) => h.type === filterType);
    // 按状态筛选
    if (statusFilter === 1) {
      filteredHistory = filteredHistory.filter((h) => !h.used && !h.disabled);
    } else if (statusFilter === 2) {
      filteredHistory = filteredHistory.filter((h) => h.used);
    } else if (statusFilter === 3) {
      filteredHistory = filteredHistory.filter((h) => h.disabled);
    }
    // 搜索过滤
    if (search.trim()) {
      const keyword = search.trim().toUpperCase();
      filteredHistory = filteredHistory.filter((h) => h.code.toUpperCase().includes(keyword));
    }
    // 分页
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedHistory = filteredHistory.slice((safePage - 1) * pageSize, safePage * pageSize);
    const usedCount = history.filter((h) => h.used).length;
    const disabledCount = history.filter((h) => h.disabled).length;

    return (
      <>
        <div className="bg-aurora" />
        <div className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-5 py-8 sm:px-6 sm:py-10">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/3 px-3.5 py-2 text-xs text-white/70 backdrop-blur transition hover:border-white/20 hover:bg-white/5 hover:text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              返回
            </Link>
            <div className="flex items-center gap-2">
              <span className="badge badge-primary">共 {history.length} 条</span>
              <button onClick={() => this.setState({ showHistory: !showHistory })} className="btn-ghost text-xs !py-1.5 !px-3">
                {showHistory ? "生成器" : "查看记录"}
              </button>
            </div>
          </div>

          {!showHistory ? (
            <div className="glass-card">
              <div className="text-center mb-6">
                <h1 className="gradient-text text-center text-xl font-bold tracking-tight sm:text-2xl">激活码生成器</h1>
                <div className="game-title-underline" />
                <p className="mt-3 text-sm text-white/60">生成天卡 / 测试卡 / 周卡 / 月卡 / 季卡 / 年卡激活码</p>
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
                <input type="range" min="1" max="50" value={count} onChange={(e) => this.setState({ count: parseInt(e.target.value) })} className="w-full accent-pink-500" />
                <div className="flex justify-between text-xs text-white/40 mt-1"><span>1</span><span>50</span></div>
              </div>

              <button onClick={this.handleGenerate} disabled={generating} className="w-full rounded-full bg-pink-500 py-3 text-base font-semibold text-white shadow-lg shadow-pink-500/40 hover:bg-pink-400 transition mb-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {generating ? `⏳ 生成中... ${progress}/${totalCount}` : "🎫 生成激活码"}
              </button>
              {generating && totalCount > 0 && (
                <div className="mb-6">
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300" style={{ width: `${(progress / totalCount) * 100}%` }} />
                  </div>
                  <p className="text-center text-xs text-white/40 mt-1">每批生成10个，避免超时，请耐心等待</p>
                </div>
              )}

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
            <div className="glass-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">📋 生成记录</h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={this.syncFromCloud} disabled={syncing} className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50">
                    {syncing ? "⏳ 同步中..." : "☁️ 云端同步"}
                  </button>
                  <button onClick={this.copyAllUnused} className="rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300 hover:bg-green-500/20 transition">复制未使用</button>
                  <button onClick={this.exportHistory} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition">导出{filterType === -1 ? "全部" : TYPE_NAMES[filterType]}</button>
                  <button onClick={this.clearCloud} className="rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/30 transition">☁️ 清空云端</button>
                  <button onClick={this.clearHistory} className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition">清空本地</button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 text-sm mb-3 flex-wrap">
                  <span className="text-white/60">共 {history.length} 条</span>
                  <span className="text-green-400">已用 {usedCount}</span>
                  <span className="text-yellow-400">未用 {history.length - usedCount - disabledCount}</span>
                  <span className="text-red-400">已禁用 {disabledCount}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((type) => {
                    const typeHistory = history.filter((h) => h.type === type);
                    const typeUsed = typeHistory.filter((h) => h.used).length;
                    const typeUnused = typeHistory.length - typeUsed;
                    return (
                      <div key={type} className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                        <div className="text-sm font-semibold text-white">{TYPE_NAMES[type]}</div>
                        <div className="text-xs mt-1">
                          <span className="text-green-400">已用 {typeUsed}</span>
                          <span className="text-white/30 mx-1">/</span>
                          <span className="text-yellow-400">未用 {typeUnused}</span>
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">共 {typeHistory.length}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-sm">
                </div>
                <button
                  onClick={this.refreshAllStatus}
                  disabled={checking}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {checking ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />
                      查询中...
                    </>
                  ) : (
                    <>🔄 刷新状态</>
                  )}
                </button>
              </div>

              <div className="mb-3">
                <div className="text-xs text-white/40 mb-2">卡类型</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => this.setState({ filterType: -1 })} className={`rounded-full px-3 py-1 text-xs transition ${filterType === -1 ? "bg-pink-500 text-white" : "bg-white/5 text-white/60"}`}>全部</button>
                  {typeOptions.map((opt) => (
                    <button key={opt.value} onClick={() => this.setState({ filterType: opt.value })} className={`rounded-full px-3 py-1 text-xs transition ${filterType === opt.value ? "bg-pink-500 text-white" : "bg-white/5 text-white/60"}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-white/40 mb-2">激活状态</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => this.setState({ statusFilter: 0 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 0 ? "bg-pink-500 text-white" : "bg-white/5 text-white/60"}`}>全部</button>
                  <button onClick={() => this.setState({ statusFilter: 1 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 1 ? "bg-yellow-500 text-black" : "bg-white/5 text-white/60"}`}>未激活 ({history.filter(h => !h.used && !h.disabled).length})</button>
                  <button onClick={() => this.setState({ statusFilter: 2 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 2 ? "bg-green-500 text-white" : "bg-white/5 text-white/60"}`}>已激活 ({history.filter(h => h.used).length})</button>
                  <button onClick={() => this.setState({ statusFilter: 3 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 3 ? "bg-red-500 text-white" : "bg-white/5 text-white/60"}`}>已禁用 ({history.filter(h => h.disabled).length})</button>
                </div>
              </div>
              {/* 搜索框 */}
              <div className="mb-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { this.setState({ search: e.target.value, currentPage: 1 }); }}
                    placeholder="搜索激活码..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/50"
                  />
                  {search && (
                    <button onClick={() => this.setState({ search: "", currentPage: 1 })} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">✕</button>
                  )}
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-white/40">{search ? "未找到匹配的激活码" : "暂无记录"}</div>
              ) : (
                <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                  {pagedHistory.map((item, i) => (
                    <div key={i} className={`rounded-xl border p-3 transition-all ${item.disabled ? "border-red-400/30 bg-red-500/10 opacity-70" : item.used ? "border-green-400/20 bg-green-500/5" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-pink-200 truncate">{item.code}</span>
                            {item.disabled && <span className="shrink-0 rounded bg-red-500/30 px-1.5 py-0.5 text-[10px] text-red-200">已禁用</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-white/50 flex-wrap">
                            <span className="rounded bg-white/10 px-1.5 py-0.5">{TYPE_NAMES[item.type]}</span>
                            <span>生成: {this.formatDate(item.createdAt)}</span>
                            {item.used && <span className="text-green-400">✓ 已激活</span>}
                          </div>
                          {item.used && (
                            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-white/40">
                              <div>🕐 {this.formatFullDate(item.usedAt)}</div>
                              <div>🌐 {this.formatIp(item.usedIp)}</div>
                            </div>
                          )}
                          {item.disabled && item.disabledReason && (
                            <div className="mt-1 text-[11px] text-red-300/70">原因: {item.disabledReason}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                        {!item.disabled && (
                          <button onClick={() => this.disableCode(i)} disabled={disabling} className="flex-1 rounded-full bg-red-500/15 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/25 transition disabled:opacity-50">封禁</button>
                        )}
                        {item.disabled && (
                          <button onClick={() => this.enableCode(i)} disabled={disabling} className="flex-1 rounded-full bg-green-500/15 px-2 py-1 text-[11px] text-green-300 hover:bg-green-500/25 transition disabled:opacity-50">解封</button>
                        )}
                        <button onClick={() => this.handleCopyCode(item.code)} className="flex-1 rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 transition">复制</button>
                        <button onClick={() => this.deleteHistory(i)} className="flex-1 rounded-full bg-red-500/10 px-2 py-1 text-[11px] text-red-400/70 hover:bg-red-500/20 transition">删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* 分页控件 */}
              {filteredHistory.length > pageSize && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-white/40">
                    共 {filteredHistory.length} 条，第 {safePage}/{totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.setState({ currentPage: Math.max(1, safePage - 1) })}
                      disabled={safePage <= 1}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >上一页</button>
                    <button
                      onClick={() => this.setState({ currentPage: Math.min(totalPages, safePage + 1) })}
                      disabled={safePage >= totalPages}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >下一页</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/80 px-6 py-3 text-sm text-white shadow-lg backdrop-blur-sm">
            {toast}
          </div>
        )}
      </>
    );
  }
}
