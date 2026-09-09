# 点赞/点踩 Worker 部署步骤（约 5 分钟，一次性）

前置：注册一个 Cloudflare 账号（只要邮箱，不要实名、不要身份证）。

在 `tools/like-worker/` 目录下执行：

```powershell
# 1. 登录（会弹浏览器授权一次）
npx wrangler login

# 2. 创建 KV 存储，复制输出的 id 填进 wrangler.toml
npx wrangler kv namespace create LIKES

# 3. 部署
npx wrangler deploy
```

部署成功会输出形如 `https://blog-likes.<你的子域>.workers.dev` 的地址。

**把地址告诉我**，我把它接进博客前端（点赞/点踩按钮 + 防重复投票），推上去即完成。
