# RMB Ledger

静态前端 + EdgeOne Node Functions + PostgreSQL `DATABASE_URL` 的单人记账本。

## 功能

- 微信 / 支付宝 / 银行卡 / 现金 / 其他存款账户
- 账户转账，不计入收入支出
- 标签系统入库：`ledger_tags` + `ledger_entry_tags`
- 本月预算、预警比例、低余额阈值
- 每日可用额度、本月 / 今日 / 近 7 日统计
- 固定支出 / 周期账单
- 删除确认、撤销删除
- JSON 导出 / 导入

## EdgeOne 环境变量

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

## 构建

```txt
安装命令：npm install --registry=https://registry.npmmirror.com --no-audit --no-fund --progress=false
构建命令：npm run build
输出目录：dist
Node 版本：22.11.0 或 22.x
```

数据库表会在首次请求时由 Node Function 自动创建。
