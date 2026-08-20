# 激活码生成器 - 独立部署版

## 简介

这是一个独立的、可直接部署到 GitHub Pages 的激活码生成器，带密码保护。

## 部署步骤

### 1. 创建新仓库

在 GitHub 创建一个新仓库（比如叫 `license-gen`）。

### 2. 上传文件

把本项目所有文件上传到新仓库的根目录。

### 3. 启用 GitHub Pages

- 进入仓库 Settings → Pages
- Source 选择 "GitHub Actions"

### 4. 自动部署

推送代码后，GitHub Actions 会自动构建并部署。

部署完成后访问：`https://你的用户名.github.io/仓库名/`

## 管理密码

默认密码：`LG@Admin2024!`

### 修改密码

打开 `app/tools/gen-license/page.tsx`，找到：
```ts
const ADMIN_PASSWORD_HASH = simpleHash("LG@Admin2024!");
```
把 `LG@Admin2024!` 改成你想要的密码。

## 激活码类型

| 类型 | 有效期 |
|------|--------|
| 天卡 | 1天 |
| 周卡 | 7天 |
| 月卡 | 30天 |
| 季卡 | 90天 |

## 功能

- 🔐 密码保护
- 📅 天卡/周卡/月卡/季卡
- 🔢 批量生成（1-50个）
- 📋 一键复制
- 💾 下载TXT

## 注意

- 首页会自动跳转到生成页面 `/tools/gen-license`
- 密码验证状态保存在浏览器本地，关闭浏览器后需重新验证
- 激活码校验逻辑在 `lib/license.ts`，需与主游戏项目保持一致
