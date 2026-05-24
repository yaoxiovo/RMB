import "./styles.css";
import {
  CATEGORIES,
  byCategory,
  calculateStats,
  daysUntilExam,
  escapeHtml,
  formatMoney,
  normalizeEntry,
  todayISO,
  trend7Days,
} from "./utils.js";

const state = {
  records: [],
  filter: "all",
  query: "",
  syncing: false,
  status: {
    type: "checking",
    text: "正在连接数据库 API",
    detail: "前端不直连数据库；DATABASE_URL 只在 EdgeOne Node Function 中读取。",
  },
  formType: "expense",
};

const app = document.querySelector("#app");

function icon(name, className = "icon") {
  const common = `class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const map = {
    arrowDownLeft: `<svg ${common}><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>`,
    arrowPath: `<svg ${common}><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h4"/><path d="M6 22v-4H2"/></svg>`,
    arrowUpRight: `<svg ${common}><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
    calendar: `<svg ${common}><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>`,
    cloud: `<svg ${common}><path d="M17.5 19H8a5 5 0 1 1 1.2-9.85A7 7 0 0 1 22 12.5 4.5 4.5 0 0 1 17.5 19Z"/></svg>`,
    database: `<svg ${common}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
    download: `<svg ${common}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`,
    layers: `<svg ${common}><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>`,
    piggy: `<svg ${common}><path d="M19 5c-1.5 0-2.8.8-3.5 2H9a6 6 0 0 0-6 6v3h3l1 3h3l1-3h4l1 3h3l1-3h1v-5h-2.2A4 4 0 0 0 19 5Z"/><path d="M8 10h.01"/><path d="M2 11v2"/></svg>`,
    plus: `<svg ${common}><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
    search: `<svg ${common}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    shield: `<svg ${common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>`,
    trash: `<svg ${common}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
    wallet: `<svg ${common}><path d="M20 7H5a2 2 0 0 1 0-4h13"/><path d="M20 7v14H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/><path d="M20 11h-5a3 3 0 0 0 0 6h5"/></svg>`,
  };
  return map[name] || map.database;
}

function setStatus(type, text, detail = "") {
  state.status = { type, text, detail };
  render();
}

function setSyncing(value) {
  state.syncing = value;
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body;
}

async function loadEntries() {
  setSyncing(true);
  try {
    const data = await api("/api/entries");
    state.records = (data.entries || []).map(normalizeEntry);
    state.status = {
      type: "ok",
      text: "数据库已连接",
      detail: "当前模式：无登录、单人账本、EdgeOne Node Function 使用 DATABASE_URL 读写 PostgreSQL。",
    };
  } catch (error) {
    state.records = [];
    state.status = {
      type: "error",
      text: "数据库 API 连接失败",
      detail: error.message,
    };
  } finally {
    state.syncing = false;
    render();
  }
}

async function createEntry(payload) {
  setSyncing(true);
  try {
    const data = await api("/api/entries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.records = [normalizeEntry(data.entry), ...state.records];
    state.status = { type: "ok", text: "已写入数据库", detail: "新增流水已通过 Node Function 入库。" };
  } catch (error) {
    state.status = { type: "error", text: "写入失败", detail: error.message };
  } finally {
    state.syncing = false;
    render();
  }
}

async function deleteEntry(id) {
  const oldRecords = state.records;
  state.records = state.records.filter((record) => record.id !== id);
  render();
  setSyncing(true);
  try {
    await api(`/api/entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    state.status = { type: "ok", text: "已删除数据库记录", detail: "删除操作已提交。" };
  } catch (error) {
    state.records = oldRecords;
    state.status = { type: "error", text: "删除失败，已回滚页面数据", detail: error.message };
  } finally {
    state.syncing = false;
    render();
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `yaoxi-ledger-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function metricCard(title, value, detail, iconName) {
  return `
    <article class="glass metric-card">
      <div class="metric-top">
        <div class="muted">${escapeHtml(title)}</div>
        <div class="metric-icon">${icon(iconName)}</div>
      </div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-detail">${escapeHtml(detail)}</div>
    </article>
  `;
}

function panel(title, subtitle, content) {
  return `
    <section class="glass panel">
      <div class="panel-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <span class="dot"></span>
      </div>
      ${content}
    </section>
  `;
}

function renderCategoryRank() {
  const data = byCategory(state.records);
  if (!data.length) return `<div class="empty">暂无支出数据</div>`;
  return `
    <div class="rank-list">
      ${data.map((item) => `
        <div>
          <div class="rank-row-top">
            <span>${escapeHtml(item.name)}</span>
            <span class="muted">${escapeHtml(formatMoney(item.value))}</span>
          </div>
          <div class="bar"><span style="width:${item.percent}%"></span></div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTrend() {
  return `
    <div class="trend">
      ${trend7Days(state.records).map((item) => `
        <div class="trend-item">
          <div class="trend-bar" style="height:${item.percent}%"></div>
          <div class="trend-label">${escapeHtml(item.key)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function visibleRecords() {
  return state.records
    .filter((record) => state.filter === "all" || record.type === state.filter)
    .filter((record) => {
      const text = `${record.title} ${record.category} ${record.note}`.toLowerCase();
      return text.includes(state.query.trim().toLowerCase());
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderRecords() {
  const records = visibleRecords();
  if (!records.length) return `<div class="empty">没有匹配记录</div>`;
  return records.map((record) => {
    const signed = record.type === "income" ? "+" : "-";
    const iconName = record.type === "income" ? "arrowDownLeft" : "arrowUpRight";
    return `
      <article class="record">
        <div class="record-icon ${record.type}">${icon(iconName)}</div>
        <div class="record-main">
          <div class="record-title-line">
            <div class="record-title">${escapeHtml(record.title)}</div>
            <span class="tag">${escapeHtml(record.category)}</span>
          </div>
          <div class="record-note">${escapeHtml(record.date)} · ${escapeHtml(record.note || "无备注")}</div>
        </div>
        <div class="record-right">
          <div class="money ${record.type}">${signed}${escapeHtml(formatMoney(record.amount))}</div>
          <button class="delete-btn" data-delete="${escapeHtml(record.id)}">${icon("trash", "icon small")} 删除</button>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  const stats = calculateStats(state.records);
  app.innerHTML = `
    <main class="app-shell">
      <div class="background">
        <div class="orb orb-a"></div>
        <div class="orb orb-b"></div>
        <div class="orb orb-c"></div>
        <div class="grid-bg"></div>
      </div>

      <div class="container">
        <header class="glass header">
          <div>
            <div class="badge">${icon("shield", "icon small")} Static Frontend · EdgeOne Node Function · DATABASE_URL</div>
            <h1>Yaoxi Ledger</h1>
            <p>静态页面只负责交互；数据库连接串只在 EdgeOne Node Function 中读取。结构接近 Umami：页面请求内部 API，服务端运行时直连 PostgreSQL。</p>
          </div>
          <div class="header-actions">
            <div class="tiny-card">
              <div class="tiny-label">${icon("calendar", "icon small")} 中考倒计时</div>
              <div class="tiny-value">D-${daysUntilExam()}</div>
            </div>
            <div class="tiny-card">
              <div class="tiny-label">${icon("layers", "icon small")} 记录数</div>
              <div class="tiny-value">${state.records.length}</div>
            </div>
            <button id="export-btn" class="btn" ${state.records.length ? "" : "disabled"}>${icon("download", "icon small")} 导出</button>
          </div>
        </header>

        <section class="glass status-bar">
          <div class="status-content">
            <div class="status-left">
              <div class="status-icon ${state.status.type === "error" ? "error" : state.status.type === "ok" ? "ok" : ""}">
                ${state.status.type === "ok" ? icon("cloud") : icon("database")}
              </div>
              <div>
                <div class="status-title">${escapeHtml(state.status.text)}</div>
                <div class="status-subtitle">${escapeHtml(state.status.detail)}</div>
              </div>
            </div>
            <button id="reload-btn" class="btn" ${state.syncing ? "disabled" : ""}>${icon("arrowPath", `icon small ${state.syncing ? "spin" : ""}`)} 重新读取</button>
          </div>
        </section>

        <section class="metric-grid">
          ${metricCard("当前余额", formatMoney(stats.balance), stats.balance >= 0 ? "预算没有失控" : "支出已超过收入", "wallet")}
          ${metricCard("总收入", formatMoney(stats.income), "所有入账累计", "arrowDownLeft")}
          ${metricCard("总支出", formatMoney(stats.expense), "所有消费累计", "arrowUpRight")}
          ${metricCard("平均支出", formatMoney(stats.avgExpense), "单笔消费均值", "piggy")}
        </section>

        <section class="main-grid">
          <div class="stack">
            ${panel("快速记一笔", "无登录、单人账本、直接入库。", `
              <form id="entry-form" class="form-stack">
                <div class="switch">
                  <button type="button" data-type="expense" class="${state.formType === "expense" ? "active" : ""}">支出</button>
                  <button type="button" data-type="income" class="${state.formType === "income" ? "active" : ""}">收入</button>
                </div>
                <input class="field" name="title" placeholder="标题，例如：晚饭 / 奖学金" required />
                <div class="form-grid">
                  <input class="field" name="amount" type="number" min="0" step="0.01" placeholder="金额" required />
                  <select name="category">
                    ${CATEGORIES.map((category) => `<option value="${escapeHtml(category)}" ${state.formType === "income" && category === "收入" ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
                  </select>
                </div>
                <input class="field" name="date" type="date" value="${todayISO()}" required />
                <textarea name="note" placeholder="备注，可不填"></textarea>
                <button class="btn btn-primary" ${state.syncing ? "disabled" : ""}>${state.syncing ? "提交中…" : "写入账本"}</button>
              </form>
            `)}

            ${panel("分类支出排行", "消费结构，一眼看穿。", renderCategoryRank())}
          </div>

          <div class="stack">
            ${panel("近 7 日支出趋势", "低波动比短暂兴奋更可靠。", renderTrend())}

            ${panel("流水记录", "筛选、搜索、删除，全部通过数据库 API 完成。", `
              <div class="toolbar">
                <div class="search-wrap">
                  ${icon("search", "icon")}
                  <input id="query-input" class="field" value="${escapeHtml(state.query)}" placeholder="搜索标题 / 分类 / 备注" />
                </div>
                <div class="filter">
                  <button data-filter="all" class="${state.filter === "all" ? "active" : ""}">全部</button>
                  <button data-filter="expense" class="${state.filter === "expense" ? "active" : ""}">支出</button>
                  <button data-filter="income" class="${state.filter === "income" ? "active" : ""}">收入</button>
                </div>
              </div>
              <div class="records">${renderRecords()}</div>
            `)}
          </div>
        </section>
      </div>
    </main>
  `;
  bindEvents();
}

function bindEvents() {
  document.querySelector("#reload-btn")?.addEventListener("click", loadEntries);
  document.querySelector("#export-btn")?.addEventListener("click", exportData);

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.formType = button.dataset.type;
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  });

  document.querySelector("#query-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteEntry(button.dataset.delete));
  });

  document.querySelector("#entry-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const type = state.formType;
    const category = String(formData.get("category") || (type === "income" ? "收入" : "其他"));

    await createEntry({
      type,
      title: String(formData.get("title") || "").trim(),
      amount,
      category,
      date: String(formData.get("date") || todayISO()),
      note: String(formData.get("note") || "").trim(),
    });
  });
}

render();
loadEntries();
