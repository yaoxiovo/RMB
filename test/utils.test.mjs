import assert from "node:assert/strict";
import {
  daysUntil,
  fromDatabase,
  getCategoryRank,
  getRecentTrend,
  summarizeStats,
  todayISO,
  toDatabase,
} from "../src/utils.js";

const mapped = fromDatabase({
  id: "1",
  type: "expense",
  title: "练习册",
  amount: "12.50",
  category: "学习",
  entry_date: "2026-05-24",
  note: null,
});

assert.equal(mapped.amount, 12.5);
assert.equal(mapped.note, "");
assert.equal(mapped.date, "2026-05-24");

const dbRow = toDatabase(mapped, "user-1");
assert.equal(dbRow.user_id, "user-1");
assert.equal(dbRow.entry_date, "2026-05-24");
assert.equal(dbRow.amount, 12.5);

assert.equal(daysUntil(new Date(2026, 5, 30), new Date(2026, 4, 24)), 37);
assert.equal(daysUntil(new Date(2026, 5, 30), new Date(2026, 6, 1)), 0);
assert.equal(todayISO(new Date("2026-05-24T12:00:00")), "2026-05-24");

const records = [
  { type: "income", amount: 100, category: "收入", date: "2026-05-24" },
  { type: "expense", amount: 20, category: "餐饮", date: "2026-05-24" },
  { type: "expense", amount: 30, category: "学习", date: "2026-05-24" },
  { type: "expense", amount: 10, category: "餐饮", date: "2026-05-23" },
];

assert.deepEqual(summarizeStats(records), {
  income: 100,
  expense: 60,
  balance: 40,
  avgExpense: 20,
});

const rank = getCategoryRank(records);
assert.equal(rank[0].name, "餐饮");
assert.equal(rank[0].value, 30);
assert.equal(rank[0].percent, 100);

const trend = getRecentTrend(records, new Date("2026-05-24T00:00:00"));
assert.equal(trend.length, 7);
assert.equal(trend.at(-1).expense, 50);
assert.equal(trend.at(-2).expense, 10);

console.log("All utility tests passed.");
