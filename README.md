# Yaoxi Ledger - EdgeOne DATABASE_URL 版

单人账本，静态前端 + EdgeOne Node Functions + PostgreSQL `DATABASE_URL`。

## 功能

- 微信 / 支付宝 / 银行卡 / 现金 / 其他存款账户
- 账户余额：初始余额 + 收入 - 支出 + 转入 - 转出
- 账户转账：不计入收入支出
- 标签系统：标签表在数据库，前端从数据库读取
- 每笔流水支持账户、分类、标签、消费评价
- 本月预算、预警比例、低余额阈值
- 今日可用额度
- 今日 / 近 7 日 / 本月统计
- 固定支出 / 周期账单，执行后生成流水并推进下次日期
- 删除确认 + 5 秒撤销
- JSON 导出 / 导入

## EdgeOne 环境变量

只需要一个：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

不要把 DATABASE_URL 写进前端源码。

## EdgeOne 构建配置

```txt
安装命令：npm install --registry=https://registry.npmmirror.com --no-audit --no-fund --progress=false
构建命令：npm run build
输出目录：dist
Node 版本：22.11.0 或 22.x
```

## 数据库

Node Function 首次请求会自动建表和补字段，也可以手动执行：

```txt
supabase/001_create_ledger_entries_no_auth.sql
```

## 本地测试

```bash
npm install
npm test
npm run build
```
