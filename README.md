# Yaoxi Ledger - EdgeOne Node Function + DATABASE_URL

这个版本用于解决 EdgeOne 构建卡在 `npm install` 的问题：

- 移除了 Vite 依赖，构建脚本只复制静态文件到 `dist`。
- 移除了 `package-lock.json`，避免锁文件里出现不可访问的私有 registry 地址。
- 新增 `.npmrc` 和 `edgeone.json`，强制使用 `npmmirror` 并关闭 audit/fund/progress。
- 只保留一个运行时依赖：`pg`，用于 EdgeOne Node Function 连接 PostgreSQL。

## 架构

```txt
浏览器静态页面
  -> fetch('/api/entries')
EdgeOne Node Function
  -> DATABASE_URL
Supabase PostgreSQL
```

## EdgeOne 环境变量

只需要配置：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

不要把 DATABASE_URL 放进前端 JS。

## EdgeOne 构建配置

项目内已经有 `edgeone.json`，会覆盖控制台构建设置：

```json
{
  "installCommand": "npm install --registry=https://registry.npmmirror.com --no-audit --no-fund --progress=false",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "nodeVersion": "22.11.0"
}
```

如果控制台没有读取 `edgeone.json`，手动设置：

```txt
安装命令：npm install --registry=https://registry.npmmirror.com --no-audit --no-fund --progress=false
构建命令：npm run build
输出目录：dist
Node 版本：22.11.0
```

## 本地测试

```bash
npm install
npm test
npm run build
```

API：

```txt
GET    /api/entries
POST   /api/entries
DELETE /api/entries?id=<uuid>
```
