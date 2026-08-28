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
    const exportData = filterType === -1 ? history : history.filter((h) => h.type === filterType);
    if (exportData.length === 0) {
      this.setState({ toast: "暂无数据可导出" });
      setTimeout(() => this.setState({ toast: "" }), 2000);
      return;
    }
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
                <h1 className="text-xl font-bold text-slate-800">验证身份</h1>
                <p className="mt-2 text-sm text-slate-500">请输入管理密码</p>
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
                  <div className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">{error}</div>
                )}
                <button type="submit" className="w-full rounded-full bg-indigo-500 py-3 text-base font-semibold text-slate-800 shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 transition">
                  验证
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">返回首页</Link>
              </div>
            </div>
          </div>
          {toast && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/80 px-6 py-3 text-sm text-slate-800 shadow-lg backdrop-blur-sm animate-fade-in">
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

    const sidebar = (
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <span className="sidebar-logo-text">管理控制台</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => window.location.href="/admin"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            控制台
          </div>
          <div className="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            激活码管理
          </div>
          <div className="nav-item" onClick={() => window.open("/ticket-admin.html","_blank")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            工单管理
          </div>
          <div className="nav-item" onClick={() => window.open("/update-history.html","_blank")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            更新历史
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="nav-item w-full" style={{color:"#f87171"}} onClick={() => { localStorage.clear(); window.location.href="/"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            退出登录
          </div>
        </div>
      </aside>
    );

    return (
      <div>
      <div className="app-bg" />
      <div className="layout">
        {sidebar}
        <div className="main-content">
          <header className="topbar">
            <h1 className="topbar-title">激活码管理</h1>
            <div className="topbar-actions">
              <span className="badge badge-primary">共 {this.state.history.length} 条</span>
            </div>
          </header>
          <main className="page-content" style={{maxWidth:"800px"}}>
          <div className="mb-6 flex items-center justify-between">
            <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/3 px-3.5 py-2 text-xs text-slate-700 backdrop-blur transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800">
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
                <p className="mt-3 text-sm text-slate-600">生成天卡 / 测试卡 / 周卡 / 月卡 / 季卡 / 年卡激活码</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-slate-700 mb-3">选择卡类型</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {typeOptions.map((opt) => (
                    <button key={opt.value} onClick={() => this.setState({ type: opt.value })}
                      className={`rounded-lg border p-3 text-center transition ${type === opt.value ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                      <div className="text-base font-semibold">{opt.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-slate-700 font-medium">生成数量</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={count}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 1;
                        this.setState({ count: Math.max(1, Math.min(50, v)) });
                      }}
                      className="w-16 px-2 py-1 text-center text-sm border border-slate-200 rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                    <span className="text-sm text-slate-500">个</span>
                  </div>
                </div>
                <input type="range" min="1" max="50" value={count} onChange={(e) => this.setState({ count: parseInt(e.target.value) })} className="w-full accent-indigo-500" />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1</span><span>50</span></div>
              </div>

              <button onClick={this.handleGenerate} disabled={generating} className="w-full rounded-full bg-indigo-500 py-3 text-base font-semibold text-slate-800 shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 transition mb-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {generating ? `⏳ 生成中... ${progress}/${totalCount}` : "🎫 生成激活码"}
              </button>
              {generating && totalCount > 0 && (
                <div className="mb-6">
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${(progress / totalCount) * 100}%` }} />
                  </div>
                  <p className="text-center text-xs text-slate-400 mt-1">每批生成10个，避免超时，请耐心等待</p>
                </div>
              )}

              {codes.length > 0 && (
                <div className="space-y-4 mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs">✓</span>
                      <span className="text-sm font-semibold text-slate-700">生成结果预览</span>
                      <span className="text-xs text-slate-400">({codes.length} 个{TYPE_NAMES[type]})</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={this.handleCopy} className="rounded-full border border-slate-300 bg-slate-50 px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition">
                        {copied ? "✓ 已复制" : "复制全部"}
                      </button>
                      <button onClick={this.handleDownload} className="rounded-full border border-slate-300 bg-slate-50 px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition">
                        下载TXT
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="space-y-2">
                      {codes.map((code, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <span className="font-mono text-sm text-indigo-600">{code}</span>
                          <button onClick={() => this.handleCopyCode(code)} className="text-xs text-slate-400 hover:text-slate-700">复制</button>
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
                <h2 className="text-xl font-bold text-slate-800">📋 生成记录</h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={this.syncFromCloud} disabled={syncing} className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 transition disabled:opacity-50">
                    {syncing ? "⏳ 同步中..." : "☁️ 云端同步"}
                  </button>
                  <button onClick={this.copyAllUnused} className="rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-xs text-green-300 hover:bg-green-100 transition">复制未使用</button>
                  <button onClick={this.exportHistory} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition">导出{filterType === -1 ? "全部" : TYPE_NAMES[filterType]}</button>
                  <button onClick={this.clearCloud} className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/30 transition">☁️ 清空云端</button>
                  <button onClick={this.clearHistory} className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 transition">清空本地</button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 text-sm mb-3 flex-wrap">
                  <span className="text-slate-600">共 {history.length} 条</span>
                  <span className="text-green-600">已用 {usedCount}</span>
                  <span className="text-amber-600">未用 {history.length - usedCount - disabledCount}</span>
                  <span className="text-red-600">已禁用 {disabledCount}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((type) => {
                    const typeHistory = history.filter((h) => h.type === type);
                    const typeUsed = typeHistory.filter((h) => h.used).length;
                    const typeUnused = typeHistory.length - typeUsed;
                    return (
                      <div key={type} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                        <div className="text-sm font-semibold text-slate-800">{TYPE_NAMES[type]}</div>
                        <div className="text-xs mt-1">
                          <span className="text-green-600">已用 {typeUsed}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-amber-600">未用 {typeUnused}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">共 {typeHistory.length}</div>
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
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-4 py-2 text-xs text-blue-600 hover:bg-blue-100 transition disabled:opacity-50 whitespace-nowrap"
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
                <div className="text-xs text-slate-400 mb-2">卡类型</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => this.setState({ filterType: -1 })} className={`rounded-full px-3 py-1 text-xs transition ${filterType === -1 ? "bg-indigo-500 text-slate-800" : "bg-slate-50 text-slate-600"}`}>全部</button>
                  {typeOptions.map((opt) => (
                    <button key={opt.value} onClick={() => this.setState({ filterType: opt.value })} className={`rounded-full px-3 py-1 text-xs transition ${filterType === opt.value ? "bg-indigo-500 text-slate-800" : "bg-slate-50 text-slate-600"}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-400 mb-2">激活状态</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => this.setState({ statusFilter: 0 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 0 ? "bg-indigo-500 text-slate-800" : "bg-slate-50 text-slate-600"}`}>全部</button>
                  <button onClick={() => this.setState({ statusFilter: 1 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 1 ? "bg-yellow-500 text-black" : "bg-slate-50 text-slate-600"}`}>未激活 ({history.filter(h => !h.used && !h.disabled).length})</button>
                  <button onClick={() => this.setState({ statusFilter: 2 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 2 ? "bg-green-500 text-slate-800" : "bg-slate-50 text-slate-600"}`}>已激活 ({history.filter(h => h.used).length})</button>
                  <button onClick={() => this.setState({ statusFilter: 3 })} className={`rounded-full px-3 py-1 text-xs transition ${statusFilter === 3 ? "bg-red-500 text-slate-800" : "bg-slate-50 text-slate-600"}`}>已禁用 ({history.filter(h => h.disabled).length})</button>
                </div>
              </div>
              {/* 搜索框 */}
              <div className="mb-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { this.setState({ search: e.target.value, currentPage: 1 }); }}
                    placeholder="搜索激活码..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                  {search && (
                    <button onClick={() => this.setState({ search: "", currentPage: 1 })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">✕</button>
                  )}
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <div className="empty-state-title">{search ? "未找到匹配的激活码" : "暂无激活码数据"}</div>
                  <div className="empty-state-desc">点击上方"生成器"生成新的激活码</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="checkbox-col">
                          <input type="checkbox" className="batch-checkbox"
                            checked={this.state.selectedCodes.length === pagedHistory.length && pagedHistory.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                this.setState({ selectedCodes: pagedHistory.map((_, idx) => idx) });
                              } else {
                                this.setState({ selectedCodes: [] });
                              }
                            }}
                          />
                        </th>
                        <th>激活码</th>
                        <th>类型</th>
                        <th>状态</th>
                        <th>生成时间</th>
                        <th>激活时间</th>
                        <th>使用IP</th>
                        <th className="action-col">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedHistory.map((item, i) => (
                        <tr key={i} style={{ opacity: item.disabled ? 0.6 : 1 }}>
                          <td className="checkbox-col">
                            <input type="checkbox" className="batch-checkbox"
                              checked={this.state.selectedCodes.includes(i)}
                              onChange={(e) => {
                                const selected = [...this.state.selectedCodes];
                                if (e.target.checked) {
                                  selected.push(i);
                                } else {
                                  const idx = selected.indexOf(i);
                                  if (idx > -1) selected.splice(idx, 1);
                                }
                                this.setState({ selectedCodes: selected });
                              }}
                            />
                          </td>
                          <td><span className="code-text">{item.code}</span></td>
                          <td><span className="badge badge-secondary">{TYPE_NAMES[item.type]}</span></td>
                          <td>
                            {item.disabled ? (
                              <span className="badge badge-danger">已禁用</span>
                            ) : item.used ? (
                              <span className="badge badge-success">已激活</span>
                            ) : (
                              <span className="badge badge-warning">未使用</span>
                            )}
                          </td>
                          <td className="text-xs text-slate-500">{this.formatDate(item.createdAt)}</td>
                          <td className="text-xs text-slate-500">{item.used ? this.formatFullDate(item.usedAt) : '-'}</td>
                          <td className="text-xs text-slate-500">{item.used ? this.formatIp(item.usedIp) : '-'}</td>
                          <td className="action-col">
                            <div className="flex items-center gap-1 justify-end">
                              {!item.disabled ? (
                                <button onClick={() => this.disableCode(i)} disabled={disabling} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50">封禁</button>
                              ) : (
                                <button onClick={() => this.enableCode(i)} disabled={disabling} className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50">解封</button>
                              )}
                              <button onClick={() => this.handleCopyCode(item.code)} className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition">复制</button>
                              <button onClick={() => this.deleteHistory(i)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition">删除</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* 批量操作栏 */}
              {this.state.selectedCodes.length > 0 && (
                <div className="batch-bar">
                  <span>已选择 <span className="selected-count">{this.state.selectedCodes.length}</span> 项</span>
                  <button onClick={() => {
                    if (confirm(`确定要封禁选中的 ${this.state.selectedCodes.length} 个激活码吗？`)) {
                      this.state.selectedCodes.forEach(idx => this.disableCode(idx));
                      this.setState({ selectedCodes: [] });
                    }
                  }} className="px-3 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded transition">批量封禁</button>
                  <button onClick={() => {
                    if (confirm(`确定要删除选中的 ${this.state.selectedCodes.length} 个激活码吗？此操作不可恢复。`)) {
                      this.state.selectedCodes.sort((a,b) => b-a).forEach(idx => this.deleteHistory(idx));
                      this.setState({ selectedCodes: [] });
                    }
                  }} className="px-3 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded transition">批量删除</button>
                  <button onClick={() => this.setState({ selectedCodes: [] })} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition ml-auto">取消选择</button>
                </div>
              )}
              {/* 分页控件 */}
              {filteredHistory.length > pageSize && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    共 {filteredHistory.length} 条，第 {safePage}/{totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.setState({ currentPage: Math.max(1, safePage - 1) })}
                      disabled={safePage <= 1}
                      className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >上一页</button>
                    <button
                      onClick={() => this.setState({ currentPage: Math.min(totalPages, safePage + 1) })}
                      disabled={safePage >= totalPages}
                      className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >下一页</button>
                  </div>
                </div>
              )}
            </div>
          )}
        {toast && (
          <div className="toast">{toast}</div>
        )}
          </main>
        </div>
      </div>
      </div>
    );
  }
}
