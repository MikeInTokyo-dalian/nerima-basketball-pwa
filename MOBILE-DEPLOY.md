# 体育馆空场手机版部署

这是可安装到 iPhone 主屏幕的 PWA。查询逻辑运行在同一 HTTPS 服务的后台，不依赖家里的电脑。

## 部署到 Render

1. 将本项目推送到 GitHub 私有仓库。
2. 登录 Render，选择 **New + → Blueprint**，连接该仓库。
3. Render 会读取根目录的 `render.yaml` 并自动构建。
4. 部署完成后会得到 `https://...onrender.com` 地址。
5. 用该地址生成二维码；iPhone 扫码后在 Safari 点“分享 → 添加到主屏幕”。

## 本地验证

```powershell
pnpm mobile:icons
pnpm mobile:build
pnpm mobile:start
```

访问 `http://localhost:4179`。PWA 的正式安装和 Service Worker 需要 HTTPS（localhost 调试除外）。

## Docker

```powershell
docker build -f Dockerfile.mobile -t nerima-court-finder .
docker run --rm -p 4179:4179 nerima-court-finder
```
