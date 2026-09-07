# 🚀 部署指南：GitHub Pages + 多设备同步

## 📋 前置准备

- [x] GitHub 账号
- [x] Git 已安装（Windows 可通过 [Git for Windows](https://git-scm.com/download/win) 安装）
- [x] VS Code 已安装
- [x] 项目文件已准备好

---

## 🎯 第一步：创建 GitHub 仓库

### 1.1 在 GitHub 创建仓库

1. 访问 https://github.com/new
2. 填写信息：
   - **Repository name**: `life-recorder`（或其他名称）
   - **Description**: `生活记录网站`（可选）
   - **Public** ✅（必须选择 Public）
   - **不要勾选** "Add a README file"（我们本地已有）
   - **不要勾选** "Add .gitignore"
   - **不要勾选** "Choose a license"
3. 点击 **Create repository**

### 1.2 复制仓库地址

创建成功后，你会看到类似这样的地址：
```
https://github.com/你的用户名/life-recorder.git
```

复制这个地址，后面会用到。

---

## 🎯 第二步：上传代码到 GitHub

### 2.1 在 VS Code 中打开终端

1. 用 VS Code 打开 `life-recorder` 文件夹
2. 按 `Ctrl + ~`（或菜单：终端 → 新终端）

### 2.2 执行 Git 命令

依次执行以下命令（每行执行一次）：

```bash
# 初始化 Git 仓库
git init

# 添加所有文件到暂存区
git add .

# 提交更改
git commit -m "Initial commit: 生活记录网站"

# 重命名分支为 main
git branch -M main

# 添加远程仓库（替换为你的实际地址）
git remote add origin https://github.com/你的用户名/life-recorder.git

# 推送到 GitHub
git push -u origin main
```

### 2.3 GitHub 登录弹窗

执行最后一条命令时，会弹出登录窗口：

1. **Sign in to GitHub**：选择 "Sign in with browser"
2. 浏览器会自动打开，登录你的 GitHub 账号
3. 回到 VS Code，点击 "Sign in"
4. 等待推送完成

---

## 🎯 第三步：启用 GitHub Pages

### 3.1 进入 Settings

1. 在 GitHub 仓库页面，点击顶部的 **Settings**（齿轮图标）
2. 左侧菜单找到 **Pages**

### 3.2 配置 Pages

1. **Source** 下拉框选择：`Deploy from a branch`
2. **Branch** 下拉框选择：`main`
3. 右侧文件夹选择：`/ (root)`
4. 点击 **Save**

### 3.3 等待部署

- GitHub 会自动部署，通常需要 1-2 分钟
- 刷新页面，顶部会出现绿色提示：
  ```
  ✅ Your site is live at https://你的用户名.github.io/life-recorder/
  ```

### 3.4 访问网站

点击链接或手动访问：
```
https://你的用户名.github.io/life-recorder/
```

---

## 🎯 第四步：多设备同步方案

### 方案 A：手动导入导出（最简单，推荐）

#### 导出流程（在旧设备上）

1. 打开网站
2. 在首页点击 **"📤 导出数据"**
3. 浏览器会下载一个 JSON 文件，例如：`life-recorder-2026-01-15.json`
4. 将这个文件上传到云盘（坚果云、OneDrive、百度网盘等）

#### 导入流程（在新设备上）

1. 在新设备访问网站
2. 从云盘下载 JSON 文件
3. 在首页点击 **"📥 导入数据"**
4. 选择刚才下载的 JSON 文件
5. 页面会自动刷新，数据已同步

**优点**：
- 无需技术背景
- 数据完全掌控在自己手中
- 可以随时备份

**缺点**：
- 需要手动操作
- 不是实时同步

---

### 方案 B：Git 同步（适合技术用户）

#### 在每台设备上克隆仓库

```bash
# 克隆仓库到本地
git clone https://github.com/你的用户名/life-recorder.git
cd life-recorder

# 用浏览器打开 index.html
start index.html  # Windows
open index.html   # Mac
```

#### 同步数据

```bash
# 在旧设备上
# 1. 导出数据到 data.json（可以写个脚本自动化）
# 2. 提交并推送
git add data.json
git commit -m "Update data"
git push

# 在新设备上
# 1. 拉取最新代码
git pull

# 2. 导入 data.json
```

**优点**：
- 有版本历史
- 可以回滚

**缺点**：
- 需要 Git 知识
- 仍然需要手动操作

---

### 方案 C：自动同步（需要后端，进阶）

如果需要真正的自动同步，可以接入后端服务：

#### 推荐方案：Firebase

1. 注册 [Firebase](https://firebase.google.com/)（免费）
2. 创建项目
3. 启用 Firestore 数据库
4. 修改代码，将 localStorage 改为 Firestore

**优点**：
- 真正的实时同步
- 多设备自动更新

**缺点**：
- 需要后端开发知识
- 需要修改代码

---

## 🎯 第五步：在各设备使用

### Windows / Mac

直接访问 GitHub Pages 网址：
```
https://你的用户名.github.io/life-recorder/
```

建议收藏到浏览器书签。

### iPhone / iPad

#### 添加到主屏幕

1. 用 Safari 访问网站
2. 点击底部的 **分享按钮**（方框+向上箭头）
3. 向下滚动，点击 **"添加到主屏幕"**
4. 输入名称（如"生活记录"）
5. 点击 **"添加"**

现在桌面会有应用图标，点击即可全屏使用。

### Android

#### 添加到主屏幕

1. 用 Chrome 访问网站
2. 点击右上角 **三个点菜单**
3. 点击 **"添加到主屏幕"** 或 **"安装应用"**
4. 输入名称
5. 点击 **"添加"**

---

## 🎯 第六步：日常更新代码

当你修改了代码后，需要更新到 GitHub：

```bash
# 查看更改
git status

# 添加更改
git add .

# 提交
git commit -m "更新说明"

# 推送
git push
```

GitHub Pages 会自动重新部署。

---

## 🔧 常见问题

### Q1: 为什么访问 GitHub Pages 显示 404？

**A**: 
- 等待 1-2 分钟，GitHub 需要时间部署
- 检查是否选择了正确的分支和文件夹
- 确认仓库是 Public

### Q2: 数据会丢失吗？

**A**: 
- 数据保存在浏览器的 localStorage 中
- 清除浏览器数据会丢失
- 建议定期导出备份

### Q3: 可以多人使用吗？

**A**: 
- 可以，但每个人的数据是独立的
- 如果需要共享数据，需要接入后端

### Q4: 可以自定义域名吗？

**A**: 
- 可以，GitHub Pages 支持自定义域名
- 需要购买域名并配置 DNS

---

## 📚 参考资源

- [GitHub Pages 官方文档](https://docs.github.com/cn/pages)
- [Git 教程](https://git-scm.com/book/zh/v2)
- [Firebase 入门](https://firebase.google.com/docs/guides)

---

## 🎉 完成！

恭喜你成功部署了生活记录网站！

现在你可以在任何设备上访问：
```
https://你的用户名.github.io/life-recorder/
```

记得定期导出数据备份！
