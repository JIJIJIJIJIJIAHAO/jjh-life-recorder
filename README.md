# 📝 生活记录网站

一个简洁优雅的本地生活记录工具，支持日视图、周视图、月视图，帮助你记录和管理日常生活。

## ✨ 功能特性

### 🏠 首页
- **艺术字标题**：从 `quotes.txt` 每日随机选取励志文案
- **本周待办**：支持设置日期和时间，自动同步到对应日视图
- **番茄钟**：25分钟专注计时，支持自定义分类标签，完成后自动记录到日视图
- **数据导入导出**：方便备份和跨设备同步

### 📅 日视图
- 24小时时间轴展示（6:00开始，0:00-6:00在底部）
- 事件色块精确对应起止时间
- 并行事件自动并列展示
- 点击空白时段快速添加日程

### 📊 周视图
- 7天网格概览
- 合并同名事件，最多显示7条
- 显示每日待办事项（可点击切换完成状态）
- 添加日程按钮固定在底部

### 📆 月视图
- 顶部看板：本月进度（小时数百分比）、专注时长（分钟）、完成待办数、待完成待办数
- 日历格显示每日感悟（文字+图片背景）
- 点击日期编辑感悟

## 🚀 快速开始

### 本地使用

1. 直接在浏览器中打开 `index.html` 即可使用
2. 数据自动保存在浏览器 localStorage 中

### 部署到 GitHub Pages

详见下方部署指南。

## 📦 部署到 GitHub Pages（多设备同步）

### 步骤 1：创建 GitHub 仓库

1. 访问 https://github.com/new
2. 仓库名：`life-recorder`
3. 设为 **Public**（GitHub Pages 免费版需要公开仓库）
4. **不要**勾选 "Add a README file"（我们已经有本地文件）
5. 点击 "Create repository"

### 步骤 2：上传代码到 GitHub

在 VS Code 中打开终端（`Ctrl + ~`），执行以下命令：

```bash
# 进入项目目录
cd life-recorder

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 生活记录网站"

# 重命名分支为 main
git branch -M main

# 添加远程仓库（替换为你的 GitHub 用户名）
git remote add origin https://github.com/你的用户名/life-recorder.git

# 推送到 GitHub
git push -u origin main
```

### 步骤 3：启用 GitHub Pages

1. 在 GitHub 仓库页面，点击 **Settings**
2. 左侧菜单选择 **Pages**
3. **Source** 选择 "Deploy from a branch"
4. **Branch** 选择 `main`，文件夹选择 `/ (root)`
5. 点击 **Save**
6. 等待 1-2 分钟

### 步骤 4：访问网站

访问 `https://你的用户名.github.io/life-recorder/`

## 🔄 多设备同步方案

### 方案 A：手动导入导出（推荐）

1. **导出数据**：在首页点击"📤 导出数据"，下载 JSON 文件
2. **上传到云盘**：将 JSON 文件上传到 GitHub 仓库、坚果云、OneDrive 等
3. **导入数据**：在其他设备访问网站后，点击"📥 导入数据"，选择 JSON 文件

### 方案 B：Git 同步（适合技术用户）

```bash
# 在每台设备上克隆仓库
git clone https://github.com/你的用户名/life-recorder.git

# 导出数据后提交
git add data.json
git commit -m "Update data"
git push

# 在其他设备上拉取
git pull
```

### 方案 C：自动同步（需要后端）

如需真正的自动同步，可以：
1. 接入 Firebase / Supabase 等后端服务
2. 添加用户登录系统
3. 数据实时同步到云端数据库

## 📱 在各设备使用

### Windows / Mac

直接访问 GitHub Pages 网址即可。

### iPhone / iPad

1. Safari 访问网站
2. 点击分享按钮 → "添加到主屏幕"
3. 可以像 App 一样使用

### Android

1. Chrome 访问网站
2. 点击菜单 → "添加到主屏幕"
3. 可以像 App 一样使用

## 🎨 自定义文案库

编辑 `quotes.txt` 文件，每行一句励志文案，系统会每日随机选取。

示例：
```
一万年太久，只争朝夕！
生活不是等待风暴过去，而是学会在雨中跳舞。
每一天都是新的开始。
```

## 🛠️ 技术栈

- 纯前端：HTML + CSS + JavaScript
- 数据存储：localStorage
- 无需后端服务器
- 响应式设计，支持手机/平板/电脑

## 📄 License

MIT License
