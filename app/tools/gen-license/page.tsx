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
      pageSize: 10, // 每页50条
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
      const auth = localStorage.getItem("lg_admin_auth");
      if (auth === "1") {
        this.setState({ authenticated: true });
        // 登录后自动从云端同步生成记录
        setTimeout(() => this.syncFromCloud(), 300);
        // 启动自动刷新定时器（每60秒刷新一次云端状态）
        this.startAutoRefresh();
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
    this.setState({ authenticated: false });
    // 退出时清除自动刷新定时器
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
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
      const hash = localStorage.getItem("lg_admin_hash") || localStorage.getItem("bbb_admin_hash") || "535441809";
      const res = await fetch(`${API_BASE_URL}/codes/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordHash: hash }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 403) {
        alert("同步失败：管理密码错误，请退出重新登录");
        this.setState({ syncing: false });
        return;
      }
      if (!res.ok) {
        alert(`同步失败：Worker返回错误 HTTP ${res.status}`);
        this.setState({ syncing: false });
        return;
      }
      const data = await res.json();
      if (!data.success) {
        alert("同步失败：" + (data.message || "未知错误"));
        this.setState({ syncing: false });
        return;
      }
      if (!data.codes || data.codes.length === 0) {
        alert("云端暂无激活码记录（之前生成的码可能未成功存入云端）");
        this.setState({ syncing: false });
        return;
      }
      const { history } = this.state;
      const localCodes = new Set(history.map((h) => cleanCode(h.code)));
      const newHistory = [...history];
      let added = 0;
      let updated = 0;
      for (const item of data.codes) {
        const clean = cleanCode(item.code);
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
          localCodes.add(clean);
          added++;
        } else {
          const idx = newHistory.findIndex((h) => cleanCode(h.code) === clean);
          if (idx >= 0) {
            newHistory[idx] = {
              ...newHistory[idx],
              code: clean,
              used: item.used,
              disabled: item.disabled || false,
              usedAt: item.usedAt || null,
              usedIp: item.usedIp || null,
              generatedIp: item.generatedIp || null,
              disabledAt: item.disabledAt || null,
              disabledReason: item.disabledReason || null,
            };
            updated++;
          }
        }
      }
      newHistory.sort((a, b) => b.createdAt - a.createdAt);
      localStorage.setItem("lg_gen_history", JSON.stringify(newHistory));
      this.setState({ history: newHistory, syncing: false });
      alert(`云端同步完成：新增 ${added} 条，更新 ${updated} 条，当前共 ${newHistory.length} 条`);
    } catch (e: any) {
      alert("同步失败：" + (e?.message || String(e)) + "\n请检查网络连接或Worker是否正常运行");
      this.setState({ syncing: false });
    }
  }

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
    const { type, count, codes, copied, authenticated, password, error, history, showHistory, filterType, checking, generating, progress, totalCount, syncing, disabling, statusFilter, search, currentPage, pageSize } = this.state;
    const { toast } = this.state;

    if (!authenticated) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
          <div style={{ width: "100%", maxWidth: "380px", padding: "32px", background: "white", borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: "56px", height: "56px", margin: "0 auto 16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>🔐</div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>后台管理</h1>
              <p style={{ fontSize: "14px", color: "#64748b" }}>请输入管理密码</p>
            </div>
            <form onSubmit={this.handlePasswordSubmit}>
              <input type="password" value={password} onChange={(e) => this.setState({ password: e.target.value })} placeholder="输入密码"
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "15px", marginBottom: "12px", outline: "none", background: "#f8fafc" }}
                onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "white"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; e.target.style.boxShadow = "none"; }} />
              {error && <div style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>{error}</div>}
              <button type="submit" style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>登 录</button>
            </form>
          </div>
        </div>
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
    if (statusFilter === 1) filteredHistory = filteredHistory.filter((h) => !h.used && !h.disabled);
    else if (statusFilter === 2) filteredHistory = filteredHistory.filter((h) => h.used);
    else if (statusFilter === 3) filteredHistory = filteredHistory.filter((h) => h.disabled);
    if (search.trim()) {
      const keyword = search.trim().toUpperCase();
      filteredHistory = filteredHistory.filter((h) => h.code.toUpperCase().includes(keyword));
    }
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedHistory = filteredHistory.slice((safePage - 1) * pageSize, safePage * pageSize);
    const usedCount = history.filter((h) => h.used).length;
    const disabledCount = history.filter((h) => h.disabled).length;

    const sidebar = (
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
          <div><div className="sidebar-title">后台管理</div><div className="sidebar-subtitle">管理控制台 v9.0</div></div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">主导航</div>
            <div className="nav-item" onClick={() => window.location.href = "/admin"}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>控制台</div>
            <div className="nav-item active"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>激活码管理</div>
            <div className="nav-item" onClick={() => window.open("/ticket-admin.html", "_blank")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>工单管理</div>
            <div className="nav-item" onClick={() => window.open("/update-history.html", "_blank")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>更新历史</div>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="nav-item" onClick={this.handleLogout}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>退出登录</div>
        </div>
      </aside>
    );

    return (
      <div className="app-layout">
        {sidebar}
        <div className="app-main">
          <header className="app-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => window.location.href = "/admin"}>← 返回</button>
              <h1 className="topbar-title">激活码管理</h1>
            </div>
            <div className="topbar-actions"><span className="badge badge-primary">共 {history.length} 条</span></div>
          </header>
          <main className="app-content">
            <div style={{ display: "flex", gap: "4px", marginBottom: "20px", padding: "4px", background: "#f1f5f9", borderRadius: "10px", width: "fit-content" }}>
              <button onClick={() => this.setState({ showHistory: false })} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer", background: !showHistory ? "white" : "transparent", color: !showHistory ? "#0f172a" : "#64748b", boxShadow: !showHistory ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>🔑 生成器</button>
              <button onClick={() => this.setState({ showHistory: true })} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer", background: showHistory ? "white" : "transparent", color: showHistory ? "#0f172a" : "#64748b", boxShadow: showHistory ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>📋 生成记录 ({history.length})</button>
            </div>

            {!showHistory ? (
              <div className="card">
                <div className="card-body">
                  <div style={{ textAlign: "center", marginBottom: "28px" }}>
                    <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>激活码生成器</h2>
                    <p style={{ fontSize: "14px", color: "#64748b" }}>生成天卡 / 测试卡 / 周卡 / 月卡 / 季卡 / 年卡激活码</p>
                  </div>
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "10px" }}>选择卡类型</label>
                    <div className="grid-4">
                      {typeOptions.map((opt: any) => (
                        <button key={opt.value} onClick={() => this.setState({ type: opt.value })}
                          style={{ padding: "14px", borderRadius: "10px", border: `2px solid ${type === opt.value ? "#6366f1" : "#e2e8f0"}`, background: type === opt.value ? "#eef2ff" : "white", cursor: "pointer", textAlign: "center" }}>
                          <div style={{ fontSize: "15px", fontWeight: 600, color: type === opt.value ? "#4f46e5" : "#0f172a" }}>{opt.label}</div>
                          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>生成数量</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input type="number" min="1" max="50" value={count} onChange={(e) => { const v = parseInt(e.target.value) || 1; this.setState({ count: Math.max(1, Math.min(50, v)) }); }} style={{ width: "70px", padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", textAlign: "center", outline: "none" }} />
                        <span style={{ fontSize: "13px", color: "#64748b" }}>个</span>
                      </div>
                    </div>
                    <input type="range" min="1" max="50" value={count} onChange={(e) => this.setState({ count: parseInt(e.target.value) })} style={{ width: "100%", accentColor: "#6366f1" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}><span>1</span><span>50</span></div>
                  </div>
                  <button onClick={this.handleGenerate} disabled={generating} style={{ width: "100%", padding: "13px", background: generating ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                    {generating ? (<><span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />生成中... {progress}/{totalCount}</>) : "🎫 生成激活码"}
                  </button>
                  {generating && totalCount > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ height: "6px", width: "100%", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)", width: `${(progress / totalCount) * 100}%`, transition: "width 0.3s" }} />
                      </div>
                      <p style={{ textAlign: "center", fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>每批生成10个，避免超时，请耐心等待</p>
                    </div>
                  )}
                  {codes.length > 0 && (
                    <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>✓</span>
                          <span style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>生成结果预览</span>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>({codes.length} 个{TYPE_NAMES[type]})</span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={this.handleCopy} className="btn btn-secondary btn-sm">{copied ? "✓ 已复制" : "复制全部"}</button>
                          <button onClick={this.handleDownload} className="btn btn-secondary btn-sm">下载TXT</button>
                        </div>
                      </div>
                      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {codes.map((code: string, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "monospace", width: "24px" }}>{i+1}.</span>
                                <span className="code-text">{code}</span>
                              </div>
                              <button onClick={() => this.handleCopyCode(code)} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", background: "white", fontSize: "12px", color: "#64748b", cursor: "pointer" }}>复制</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">📋 生成记录</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={this.syncFromCloud} disabled={syncing} className="btn btn-secondary btn-sm">{syncing ? "⏳ 同步中..." : "☁️ 云端同步"}</button>
                    <button onClick={this.copyAllUnused} className="btn btn-secondary btn-sm">复制未使用</button>
                    <button onClick={this.exportHistory} className="btn btn-secondary btn-sm">导出{filterType === -1 ? "全部" : TYPE_NAMES[filterType]}</button>
                    <button onClick={this.clearCloud} className="btn btn-danger btn-sm">☁️ 清空云端</button>
                    <button onClick={this.clearHistory} className="btn btn-danger btn-sm">清空本地</button>
                  </div>
                </div>
                <div style={{ padding: "16px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#475569" }}>共 <b style={{ color: "#0f172a" }}>{history.length}</b> 条</span>
                  <span style={{ fontSize: "13px", color: "#059669" }}>已用 <b>{usedCount}</b></span>
                  <span style={{ fontSize: "13px", color: "#d97706" }}>未用 <b>{history.length - usedCount - disabledCount}</b></span>
                  <span style={{ fontSize: "13px", color: "#dc2626" }}>已禁用 <b>{disabledCount}</b></span>
                  <button onClick={this.refreshAllStatus} disabled={checking} className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}>
                    {checking ? (<><span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.6s linear infinite", verticalAlign: "middle", marginRight: "6px" }} />查询中...</>) : "🔄 刷新状态"}
                  </button>
                </div>
                <div className="filter-bar">
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>卡类型:</span>
                  <button onClick={() => this.setState({ filterType: -1 })} className={`btn btn-sm ${filterType === -1 ? "btn-primary" : "btn-ghost"}`}>全部</button>
                  {typeOptions.map((opt: any) => (<button key={opt.value} onClick={() => this.setState({ filterType: opt.value })} className={`btn btn-sm ${filterType === opt.value ? "btn-primary" : "btn-ghost"}`}>{opt.label}</button>))}
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginLeft: "12px" }}>状态:</span>
                  <button onClick={() => this.setState({ statusFilter: 0 })} className={`btn btn-sm ${statusFilter === 0 ? "btn-primary" : "btn-ghost"}`}>全部</button>
                  <button onClick={() => this.setState({ statusFilter: 1 })} className={`btn btn-sm ${statusFilter === 1 ? "btn-warning" : "btn-ghost"}`}>未激活</button>
                  <button onClick={() => this.setState({ statusFilter: 2 })} className={`btn btn-sm ${statusFilter === 2 ? "btn-success" : "btn-ghost"}`}>已激活</button>
                  <button onClick={() => this.setState({ statusFilter: 3 })} className={`btn btn-sm ${statusFilter === 3 ? "btn-danger" : "btn-ghost"}`}>已禁用</button>
                </div>
                <div style={{ padding: "0 20px 14px" }}>
                  <div style={{ position: "relative", maxWidth: "500px" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
                    <input type="text" value={search} onChange={(e) => { this.setState({ search: e.target.value, currentPage: 1 }); }} placeholder="搜索激活码..."
                      style={{ width: "100%", padding: "7px 12px 7px 36px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", outline: "none", background: "#f8fafc" }}
                      onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "white"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; e.target.style.boxShadow = "none"; }} />
                  </div>
                </div>
                {filteredHistory.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div className="empty-state-title">{search ? "未找到匹配的激活码" : "暂无激活码数据"}</div>
                    <div className="empty-state-desc">点击上方"生成器"生成新的激活码</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>激活码</th><th>类型</th><th>状态</th><th>生成时间</th><th>激活时间</th><th>使用IP</th><th className="action-col">操作</th></tr></thead>
                      <tbody>
                        {pagedHistory.map((item: any, i: number) => (
                          <tr key={i} style={{ opacity: item.disabled ? 0.6 : 1 }}>
                            <td><span className="code-text">{item.code}</span></td>
                            <td><span className="badge badge-secondary">{TYPE_NAMES[item.type]}</span></td>
                            <td>{item.disabled ? <span className="badge badge-danger">已禁用</span> : item.used ? <span className="badge badge-success">已激活</span> : <span className="badge badge-warning">未使用</span>}</td>
                            <td style={{ fontSize: "12px", color: "#64748b" }}>{this.formatDate(item.createdAt)}</td>
                            <td style={{ fontSize: "12px", color: "#64748b" }}>{item.used ? this.formatFullDate(item.usedAt) : "-"}</td>
                            <td style={{ fontSize: "12px", color: "#64748b" }}>{item.used ? this.formatIp(item.usedIp) : "-"}</td>
                            <td className="action-col">
                              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                                {item.used && !item.disabled ? <button onClick={() => this.disableCode(i)} disabled={disabling} className="btn btn-danger btn-sm">封禁</button> : item.disabled ? <button onClick={() => this.enableCode(i)} disabled={disabling} className="btn btn-success btn-sm">解封</button> : null}
                                <button onClick={() => this.handleCopyCode(item.code)} className="btn btn-ghost btn-sm">复制</button>
                                <button onClick={() => this.deleteHistory(i)} className="btn btn-danger btn-sm">删除</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {filteredHistory.length > pageSize && (
                  <div className="pagination">
                    <div className="pagination-info">共 {filteredHistory.length} 条，第 {safePage}/{totalPages} 页</div>
                    <div className="pagination-controls">
                      <button className="pagination-btn" onClick={() => this.setState({ currentPage: Math.max(1, safePage - 1) })} disabled={safePage <= 1}>上一页</button>
                      <button className="pagination-btn active">{safePage}</button>
                      <button className="pagination-btn" onClick={() => this.setState({ currentPage: Math.min(totalPages, safePage + 1) })} disabled={safePage >= totalPages}>下一页</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
        {toast && <div className="toast">{toast}</div>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
}
