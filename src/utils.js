export const CATEGORIES = ["餐饮", "交通", "学习", "数码", "社交", "日用", "收入", "其他"];
export const EXAM_DATE = new Date(2026, 5, 30, 0, 0, 0);

export function fromDatabase(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    date: row.entry_date,
    note: row.note || "",
  };
}

export function toDatabase(record, userId) {
  return {
    user_id: userId,
    type: record.type,
    title: record.title,
    amount: Number(record.amount),
    category: record.category,
    entry_date: record.date,
    note: record.note || "",
  };
}

export function formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function todayISO(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export function daysUntil(targetDate, fromDate = new Date()) {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diff = Math.ceil((target - from) / 86400000);
  return Math.max(diff, 0);
}

export function summarizeStats(records) {
  const income = records.filter((r) => r.type === "income").reduce((sum, r) => sum + Number(r.amount), 0);
  const expense = records.filter((r) => r.type === "expense").reduce((sum, r) => sum + Number(r.amount), 0);
  const expenseCount = records.filter((r) => r.type === "expense").length;

  return {
    income,
    expense,
    balance: income - expense,
    avgExpense: expense / Math.max(expenseCount, 1),
  };
}

export function getCategoryRank(records) {
  const map = new Map();
  records
    .filter((record) => record.type === "expense")
    .forEach((record) => {
      map.set(record.category, (map.get(record.category) || 0) + Number(record.amount));
    });

  const max = Math.max(...map.values(), 1);

  return [...map.entries()]
    .map(([name, value]) => ({
      name,
      value,
      percent: Math.round((value / max) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function getRecentTrend(records, baseDate = new Date()) {
  const lastSeven = [...Array(7)].map((_, index) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - (6 - index));
    const key = d.toISOString().slice(5, 10);
    const iso = d.toISOString().slice(0, 10);
    const expense = records
      .filter((record) => record.type === "expense" && record.date === iso)
      .reduce((sum, record) => sum + Number(record.amount), 0);

    return { key, expense };
  });

  const max = Math.max(...lastSeven.map((item) => item.expense), 1);
  return lastSeven.map((item) => ({
    ...item,
    percent: Math.max(8, Math.round((item.expense / max) * 100)),
  }));
}
