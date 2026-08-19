"use client";
import Link from "next/link";
import React from "react";
import { generateCode, TYPE_NAMES } from "../../../lib/license";

// 密码哈希（非明文存储，修改密码需重新计算哈希值）
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const ADMIN_PASSWORD_HASH = 101217437510939025;

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
  };

  componentDidMount() {
    // 检查是否已验证
    if (typeof window !== "undefined") {
      const auth = localStorage.getItem("lg_admin_auth");
      if (auth === "1") {
        this.setState({ authenticated: true });
      }
    }
  }

  handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { password } = this.state;
    if (simpleHash(password) === ADMIN_PASSWORD_HASH) {
      localStorage.setItem("lg_admin_auth", "1");
      this.setState({ authenticated: true, password: "", error: "" });
    } else {
      this.setState({ error: "密码错误，请重试" });
    }
  };

  handleLogout = () => {
    localStorage.removeItem("lg_admin_auth");
    this.setState({ authenticated: false });
  };

  handleGenerate = () => {
    const newCodes: string[] = [];
    for (let i = 0; i < this.state.count; i++) {
      newCodes.push(generateCode(this.state.type));
    }
    this.setState({ codes: newCodes, copied: false });
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

  render() {
    const { type, count, codes, copied, authenticated, password, error } = this.state;

    // 未验证，显示密码输入
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
                <button
                  type="submit"
                  className="w-full rounded-full bg-pink-500 py-3 text-base font-semibold text-white shadow-lg shadow-pink-500/40 hover:bg-pink-400 transition"
                >
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
      { value: 1, label: "天卡", desc: "1天有效期" },
      { value: 2, label: "周卡", desc: "7天有效期" },
      { value: 3, label: "月卡", desc: "30天有效期" },
      { value: 4, label: "季卡", desc: "90天有效期" },
    ];

    return (
      <>
        <div className="bg-aurora" />
        <div className="relative z-10 mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="back-btn inline-flex">← 返回首页</Link>
            <button onClick={this.handleLogout} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 transition">
              退出登录
            </button>
          </div>

          <div className="game-container">
            <div className="text-center mb-6">
              <h1 className="game-title">激活码生成器</h1>
              <div className="game-title-underline" />
              <p className="mt-3 text-sm text-white/60">生成天卡 / 周卡 / 月卡 / 季卡激活码</p>
            </div>

            {/* 类型选择 */}
            <div className="mb-6">
              <label className="block text-sm text-white/70 mb-3">选择卡类型</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => this.setState({ type: opt.value })}
                    className={`rounded-xl border p-3 text-center transition ${
                      type === opt.value
                        ? "border-pink-400/60 bg-pink-500/20 ring-2 ring-pink-400/30"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="text-base font-semibold">{opt.label}</div>
                    <div className="text-xs text-white/50 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 数量选择 */}
            <div className="mb-6">
              <label className="block text-sm text-white/70 mb-2">生成数量：{count} 个</label>
              <input
                type="range"
                min="1"
                max="50"
                value={count}
                onChange={(e) => this.setState({ count: parseInt(e.target.value) })}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-xs text-white/40 mt-1">
                <span>1</span>
                <span>50</span>
              </div>
            </div>

            {/* 生成按钮 */}
            <button
              onClick={this.handleGenerate}
              className="w-full rounded-full bg-pink-500 py-3 text-base font-semibold text-white shadow-lg shadow-pink-500/40 hover:bg-pink-400 transition mb-6"
            >
              🎫 生成激活码
            </button>

            {/* 生成结果 */}
            {codes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">已生成 {codes.length} 个{TYPE_NAMES[type]}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={this.handleCopy}
                      className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                    >
                      {copied ? "✓ 已复制" : "复制全部"}
                    </button>
                    <button
                      onClick={this.handleDownload}
                      className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                    >
                      下载TXT
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="space-y-2">
                    {codes.map((code, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                      >
                        <span className="font-mono text-sm text-pink-200">{code}</span>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(code);
                            } catch {}
                          }}
                          className="text-xs text-white/40 hover:text-white/70"
                        >
                          复制
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-xs text-white/40">
              <p>激活码格式：XXXX-XXXX-XXXXX</p>
              <p className="mt-1">用户在 /activate 页面输入激活码即可解锁</p>
            </div>
          </div>
        </div>
      </>
    );
  }
}
