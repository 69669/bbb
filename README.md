# 激活码生成器 - 独立源码

## 文件说明

```
license-generator/
├── app/
│   └── tools/
│       └── gen-license/
│           └── page.tsx    # 生成页面（含密码保护）
└── lib/
    └── license.ts           # 激活码工具函数（生成/验证/激活）
```

## 部署方式

将这两个文件放入你的 Next.js 项目对应目录即可：
- `app/tools/gen-license/page.tsx` → 项目的 `app/tools/gen-license/page.tsx`
- `lib/license.ts` → 项目的 `lib/license.ts`

## 访问地址

部署后访问：`https://你的域名/tools/gen-license`

## 管理密码

默认密码：`LG@Admin2024!`

### 修改密码

打开 `app/tools/gen-license/page.tsx`，找到第 20 行左右：
```ts
const ADMIN_PASSWORD_HASH = simpleHash("LG@Admin2024!");
```
把 `LG@Admin2024!` 改成你想要的密码即可。

## 激活码类型

| 类型 | 有效期 | 类型码 |
|------|--------|--------|
| 天卡 | 1天 | 1 |
| 周卡 | 7天 | 2 |
| 月卡 | 30天 | 3 |
| 季卡 | 90天 | 4 |

## 激活码格式

`XXXX-XXXX-XXXXX`（13位，含校验位）

- 前缀：LG
- 类型：1位（1-4）
- 随机字符：8位（去掉易混淆字符）
- 校验位：2位

## 功能特性

- 🔐 密码保护，防止未授权访问
- 📅 支持天卡/周卡/月卡/季卡
- 🔢 批量生成（1-50个）
- 📋 一键复制全部
- 💾 下载TXT文件
- 📱 单个激活码复制
- 🚪 退出登录

## 配合使用

激活页面：`/activate`（用户输入激活码）
游戏页面：5个游戏已集成激活验证（飞行棋除外）
