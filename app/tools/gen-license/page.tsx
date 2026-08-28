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
      selectedCodes: [], // 批量选中的索引
      toast: "", // 提示信息
      statusFilter: 0, // 0=全部, 1=未激活, 2=已激活, 3=已禁用
      search: "", // 搜索关键词
      currentPage: 1, // 当前页码
      pageSize: 10, // 每页10条
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
  selectedCodes: number[];
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
      // 合并云端记录到本地（去重）
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
          // 更新本地记录的使用状态
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
      // 按生成时间倒序
      newHistory.sort((a, b) => b.createdAt - a.createdAt);
      localStorage.setItem("lg_gen_history", JSON.stringify(newHistory));
      this.setState({ history: newHistory, syncing: false });
      alert(`云端同步完成：新增 ${added} 条，更新 ${updated} 条，当前共 ${newHistory.length} 条`);
    } catch (e: any) {
      alert("同步失败：" + (e?.message || String(e)) + "\n请检查网络连接或Worker是否正常运行");
      this.setState({ syncing: false });
    }
  }


