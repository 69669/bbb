// 激活码工具函数
// 类型：A=周卡(7天), B=月卡(30天), C=季卡(90天), D=年卡(365天)
// 格式：7位字母+数字大写（无横线）
// ============================================
// ⚠️ 重要配置：Cloudflare Workers API 地址
// ============================================
const API_BASE_URL = "https://api.ttla.top";

const TYPE_DAYS: Record<string, number> = {
  A: 7,
  B: 30,
  C: 90,
  D: 365,
};

export const TYPE_NAMES: Record<number, string> = {
  1: "周卡",
  2: "月卡",
  3: "季卡",
  4: "年卡",
};

// 类型数字到字母的映射
const TYPE_NUM_TO_CHAR: Record<number, string> = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
};

// 类型字母到数字的映射
const TYPE_CHAR_TO_NUM: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

// 可用字符（去掉易混淆的I/O/0/1）
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function randomStr(len: number): string {
  let result = "";
  for (let i = 0; i < len; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

// 计算校验位（基于前6位）
function calcCheckChar(raw6: string): string {
  const hash = hashStr(raw6);
  return CHARS[hash % CHARS.length];
}

// 生成激活码（7位，无横线）
export function generateCode(type: number): string {
  const typeChar = TYPE_NUM_TO_CHAR[type] || "A";
  const random = randomStr(5);
  const raw6 = typeChar + random;
  const check = calcCheckChar(raw6);
  return raw6 + check;
}

// 解析激活码
export function parseCode(code: string): { type: number } | null {
  const clean = code.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 7) return null;
  const typeChar = clean[0];
  const type = TYPE_CHAR_TO_NUM[typeChar];
  if (!type) return null;
  const raw6 = clean.slice(0, 6);
  const check = clean[6];
  const expectedCheck = calcCheckChar(raw6);
  if (check !== expectedCheck) return null;
  return { type };
}

// 云端验证：检查码是否已使用
async function cloudCheck(code: string): Promise<{ used: boolean } | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/check?code=${encodeURIComponent(code)}`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return { used: !!data.used };
    }
    return null;
  } catch {
    return null;
  }
}

// 云端激活：标记码为已使用
async function cloudActivate(code: string): Promise<{ success: boolean; message: string } | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: !!data.success, message: data.message || "" };
    }
    return null;
  } catch {
    return null;
  }
}

// 验证激活码并激活
export function activateCode(code: string): Promise<{ success: boolean; message: string; type?: number; expireAt?: number }> {
  return (async () => {
    if (typeof window === "undefined") {
      return { success: false, message: "服务端环境" };
    }
    const parsed = parseCode(code);
    if (parsed === null) {
      return { success: false, message: "激活码格式不正确或已失效" };
    }
    const clean = code.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    // ===== 云端验证（一人一码核心）=====
    const cloudResult = await cloudActivate(clean);
    if (cloudResult !== null) {
      if (!cloudResult.success) {
        return { success: false, message: cloudResult.message || "该激活码已被使用" };
      }
    } else {
      // 云端不可用，降级到本地检查
      try {
        const usedCodes = JSON.parse(localStorage.getItem("lg_used_codes") || "[]");
        if (usedCodes.includes(clean)) {
          return { success: false, message: "该激活码已被使用，无法重复激活" };
        }
        usedCodes.push(clean);
        localStorage.setItem("lg_used_codes", JSON.stringify(usedCodes));
      } catch {}
    }
    // 保存激活信息到本地
    const days = TYPE_DAYS[clean[0]] || 7;
    const now = Date.now();
    const expireAt = now + days * 24 * 60 * 60 * 1000;
    const activation = {
      code: clean,
      type: parsed.type,
      activatedAt: now,
      expireAt,
    };
    localStorage.setItem("lg_activation", JSON.stringify(activation));
    return {
      success: true,
      message: `激活成功！${TYPE_NAMES[parsed.type]}有效期，${days}天后过期`,
      type: parsed.type,
      expireAt,
    };
  })();
}

// 检查是否已激活且未过期
export function checkActivation(): { active: boolean; type?: number; expireAt?: number; daysLeft?: number } {
  if (typeof window === "undefined") {
    return { active: false };
  }
  const data = localStorage.getItem("lg_activation");
  if (!data) return { active: false };
  try {
    const activation = JSON.parse(data);
    const now = Date.now();
    if (now > activation.expireAt) {
      return { active: false };
    }
    const daysLeft = Math.ceil((activation.expireAt - now) / (24 * 60 * 60 * 1000));
    return {
      active: true,
      type: activation.type,
      expireAt: activation.expireAt,
      daysLeft,
    };
  } catch {
    return { active: false };
  }
}

export function clearActivation() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lg_activation");
}
