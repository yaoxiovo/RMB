import assert from "node:assert/strict";
import {
  byCategory,
  calculateStats,
  daysUntil,
  escapeHtml,
  formatMoney,
  normalizeEntry,
  todayISO,
  trend7Days,
} from "../src/utils.js";

const records = [
  { id: "1", type: "income", title: "收入", amount: 100, category: "收入", date: "2026-05-24", note: "" },
  { id: "2", type: "expense", title: "午饭", amount: 18.5, category: "餐饮", date: "2026-05-24", note: "" },
  { id: "3", type: "expense", title: "练习册", amount: 32, category: "学习", date: "2026-05-23", note: "" },
];

assert.equal(daysUntil(new Date(2026, 5, 30), new Date(2026, 4, 24)), 37);
assert.equal(todayISO(new Date("2026-05-24T12:00:00")), "2026-05-24");
assert.ok(formatMoney(1.5).includes("1.5"));

const stats = calculateStats(records);
assert.equal(stats.income, 100);
assert.equal(stats.expense, 50.5);
assert.equal(stats.balance, 49.5);
assert.equal(stats.avgExpense, 25.25);

const categories = byCategory(records);
assert.equal(categories[0].name, "学习");
assert.equal(categories[0].value, 32);
assert.equal(categories[1].name, "餐饮");

const trend = trend7Days(records, new Date("2026-05-24T12:00:00"));
assert.equal(trend.length, 7);
assert.equal(trend.at(-1).expense, 18.5);

const normalized = normalizeEntry({
  id: 123,
  type: "expense",
  title: "x",
  amount: "12.50",
  category: "其他",
  entry_date: "2026-05-24",
  note: null,
});
assert.equal(normalized.id, "123");
assert.equal(normalized.amount, 12.5);
assert.equal(normalized.date, "2026-05-24");
assert.equal(normalized.note, "");

assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
console.log("All utility tests passed.");

import { readFile } from "node:fs/promises";

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.ok(!mainSource.includes('import "./styles.css"'), "no-bundler build must not import CSS from JS");
assert.match(htmlSource, /<link\s+rel="stylesheet"\s+href="\.\/src\/styles\.css"\s*\/>/, "index.html should load CSS with a link tag");
