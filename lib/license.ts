// 激活码工具函数
// 类型：1=天卡(1天), 2=周卡(7天), 3=月卡(30天), 4=季卡(90天)
const TYPE_DAYS: Record<number, number> = {
  1: 1,
  2: 7,
  3: 30,
  4: 90,
};
export const TYPE_NAMES: Record<number, string> = {
  1: "天卡",
  2: "周卡",
  3: "月卡",
  4: "季卡",
};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆字符
const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const EPOCH = new Date("2025-01-01").getTime();
const ACTIVATE_VALIDITY_DAYS = 90; // 激活码生成后90天内必须激活

// 简单的字符串哈希
function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// 生成随机字符串
function randomStr(len: number): string {
  let result = "";
  for (let i = 0; i < len; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

// 获取当前天数（从2025-01-01开始）
function getCurrentDay(): number {
  return Math.floor((Date.now() - EPOCH) / (24 * 60 * 60 * 1000));
}

// 天数转36进制（2位）
function dayToBase36(day: number): string {
  const n = ((day % 1296) + 1296) % 1296;
  return BASE36[Math.floor(n / 36)] + BASE36[n % 36];
}

// 36进制转天数
function base36ToDay(str: string): number {
  return BASE36.indexOf(str[0]) * 36 + BASE36.indexOf(str[1]);
}

// 生成激活码
// 格式：LG + 类型(1位) + 生成天数(2位36进制) + 随机(6位) + 校验(2位) = 13位
export function generateCode(type: number): string {
  const typeChar = String(type);
  const dayChar = dayToBase36(getCurrentDay());
  const random = randomStr(6);
  const raw = `LG${typeChar}${dayChar}${random}`;
  const checkNum = hashStr(raw) % 100;
  const check = String(checkNum).padStart(2, "0");
  const full = `LG${typeChar}${dayChar}${random}${check}`;
  return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8)}`;
}

// 解析激活码，返回类型或null
export function parseCode(code: string): { type: number; day: number } | null {
  const clean = code.replace(/-/g, "").toUpperCase().trim();
  if (clean.length !== 13) return null;
  if (!clean.startsWith("LG")) return null;

  const typeChar = clean[2];
  const type = parseInt(typeChar, 10);
  if (![1, 2, 3, 4].includes(type)) return null;

  const dayChar = clean.slice(3, 5);
  const day = base36ToDay(dayChar);
  const random = clean.slice(5, 11);
  const check = clean.slice(11);
  const raw = `LG${typeChar}${dayChar}${random}`;
  const expectedCheck = String(hashStr(raw) % 100).padStart(2, "0");

  if (check !== expectedCheck) return null;

  return { type, day };
}

// 验证激活码并激活
export function activateCode(code: string): { success: boolean; message: string; type?: number; expireAt?: number } {
  if (typeof window === "undefined") {
    return { success: false, message: "服务端环境" };
  }

  const parsed = parseCode(code);
  if (parsed === null) {
    return { success: false, message: "激活码格式不正确或已失效" };
  }

  const clean = code.replace(/-/g, "").toUpperCase().trim();

  // 检查是否已使用过（本地记录）
  try {
    const usedCodes = JSON.parse(localStorage.getItem("lg_used_codes") || "[]");
    if (usedCodes.includes(clean)) {
      return { success: false, message: "该激活码已被使用，无法重复激活" };
    }
  } catch {}

  // 检查激活码是否在有效期内（生成后90天内）
  const currentDay = getCurrentDay();
  const daysSinceGen = ((currentDay - parsed.day) % 1296 + 1296) % 1296;
  if (daysSinceGen > ACTIVATE_VALIDITY_DAYS) {
    return { success: false, message: `激活码已过期（生成后${ACTIVATE_VALIDITY_DAYS}天内有效）` };
  }

  const days = TYPE_DAYS[parsed.type];
  const now = Date.now();
  const expireAt = now + days * 24 * 60 * 60 * 1000;

  // 保存激活信息
  const activation = {
    code: clean,
    type: parsed.type,
    generatedDay: parsed.day,
    activatedAt: now,
    expireAt,
  };
  localStorage.setItem("lg_activation", JSON.stringify(activation));

  // 记录已使用的激活码
  try {
    const usedCodes = JSON.parse(localStorage.getItem("lg_used_codes") || "[]");
    usedCodes.push(clean);
    localStorage.setItem("lg_used_codes", JSON.stringify(usedCodes));
  } catch {}

  return {
    success: true,
    message: `激活成功！${TYPE_NAMES[parsed.type]}有效期，${days}天后过期`,
    type: parsed.type,
    expireAt,
  };
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

// 清除激活（测试用）
export function clearActivation() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lg_activation");
}
