# Yaoxi Ledger - EdgeOne DATABASE_URL Version

这是一个静态前端 + EdgeOne Node Function + PostgreSQL 的记账本。

架构接近 Umami：

```txt
浏览器静态页面
  -> /api/entries
EdgeOne Node Function
  -> DATABASE_URL
Supabase PostgreSQL
```

前端不读取 `DATABASE_URL`。数据库连接串只放在 EdgeOne 项目设置的环境变量中。

## EdgeOne 环境变量

在 EdgeOne 控制台：项目设置 -> 环境变量，新增：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

Supabase 的 Transaction pooler URI 可以用。Node Function 内部使用 `pg` 连接 PostgreSQL。

## EdgeOne 构建配置

```txt
安装命令：npm install
构建命令：npm run build
输出目录：dist
```

函数目录：

```txt
node-functions/api/entries.js
```

部署后接口为：

```txt
GET    /api/entries
POST   /api/entries
DELETE /api/entries?id=<uuid>
```

## 本地开发

前端预览：

```bash
npm install
npm run dev
```

如果要本地完整调试 Node Function，请使用 EdgeOne CLI：

```bash
npm install -g edgeone
edgeone pages dev
```

## 测试

```bash
npm test
```

## 数据库表

函数首次请求会自动创建 `public.ledger_entries` 表。你也可以手动执行：

```txt
supabase/001_create_ledger_entries_no_auth.sql
```

## 说明

这是单人账本，无登录、无 RLS 用户隔离。只要页面公开访问，别人理论上也能调用 `/api/entries` 操作数据。你要求的是“暴力改动”，所以这里没有加认证。
