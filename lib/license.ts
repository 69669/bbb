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

// 生成激活码
// 格式：LG + 类型(1位) + 随机(8位) + 校验(2位) = 13位，分3段显示
export function generateCode(type: number): string {
  const typeChar = String(type);
  const random = randomStr(8);
  const raw = `LG${typeChar}${random}`;
  const checkNum = hashStr(raw) % 100;
  const check = String(checkNum).padStart(2, "0");
  const full = `LG${typeChar}${random}${check}`;
  // 格式化为 XXXX-XXXX-XXXXX
  return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8)}`;
}

// 解析激活码，返回类型或null
export function parseCode(code: string): number | null {
  const clean = code.replace(/-/g, "").toUpperCase().trim();
  if (clean.length !== 13) return null;
  if (!clean.startsWith("LG")) return null;
  
  const typeChar = clean[2];
  const type = parseInt(typeChar, 10);
  if (![1, 2, 3, 4].includes(type)) return null;
  
  const random = clean.slice(3, 11);
  const check = clean.slice(11);
  const raw = `LG${typeChar}${random}`;
  const expectedCheck = String(hashStr(raw) % 100).padStart(2, "0");
  
  if (check !== expectedCheck) return null;
  
  return type;
}

// 验证激活码并激活
export function activateCode(code: string): { success: boolean; message: string; type?: number; expireAt?: number } {
  if (typeof window === "undefined") {
    return { success: false, message: "服务端环境" };
  }
  const type = parseCode(code);
  if (type === null) {
    return { success: false, message: "激活码格式不正确或已失效" };
  }
  
  const clean = code.replace(/-/g, "").toUpperCase().trim();
  
  // 检查是否已使用过（简单的本地记录）
  const usedCodes = JSON.parse(localStorage.getItem("lg_used_codes") || "[]");
  if (usedCodes.includes(clean)) {
    return { success: false, message: "该激活码已被使用" };
  }
  
  const days = TYPE_DAYS[type];
  const now = Date.now();
  const expireAt = now + days * 24 * 60 * 60 * 1000;
  
  // 保存激活信息
  const activation = {
    code: clean,
    type,
    activatedAt: now,
    expireAt,
  };
  localStorage.setItem("lg_activation", JSON.stringify(activation));
  
  // 记录已使用的激活码
  usedCodes.push(clean);
  localStorage.setItem("lg_used_codes", JSON.stringify(usedCodes));
  
  return {
    success: true,
    message: `激活成功！${TYPE_NAMES[type]}有效期，${days}天后过期`,
    type,
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
