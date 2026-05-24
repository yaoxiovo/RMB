# Yaoxi Ledger Static

静态部署的透明毛玻璃记账本，使用 Google OAuth 登录，Supabase PostgreSQL 存储数据。

## 目录

```txt
.
├── index.html
├── package.json
├── .env.example
├── src
│   ├── main.js
│   ├── styles.css
│   ├── utils.js
│   └── lib
│       └── supabase.js
├── supabase
│   └── 001_create_ledger_entries.sql
└── test
    └── utils.test.mjs
```

## 安装

```bash
npm install
```

## 环境变量

复制示例文件：

```bash
cp .env.example .env.local
```

填写：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

注意：`VITE_SUPABASE_ANON_KEY` 会进入前端构建产物，它是 public anon key，不是 service role key。不要把 `service_role` 放进任何前端环境变量。

## Supabase 数据库

在 Supabase SQL Editor 执行：

```txt
supabase/001_create_ledger_entries.sql
```

这会创建 `ledger_entries` 表，并启用 RLS：用户只能读写 `auth.uid() = user_id` 的记录。

## Google 登录配置

1. Supabase Dashboard -> Authentication -> Providers -> Google -> Enable
2. 填入 Google Client ID 和 Client Secret
3. Google Cloud OAuth Client 添加回调地址：

```txt
https://your-project-ref.supabase.co/auth/v1/callback
```

4. Supabase Auth URL Configuration 添加你的站点地址，例如：

```txt
http://localhost:5173
https://your-domain.example
```

## 本地开发

```bash
npm run dev
```

## 测试

```bash
npm test
```

## 构建静态文件

```bash
npm run build
```

输出目录：

```txt
dist
```

把 `dist` 部署到 EdgeOne Pages、Vercel、Netlify、Cloudflare Pages 等静态托管平台即可。
