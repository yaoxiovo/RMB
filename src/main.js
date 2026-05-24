import "./styles.css";
import { supabase, hasSupabaseConfig } from "./lib/supabase.js";
import {
  CATEGORIES,
  EXAM_DATE,
  daysUntil,
  formatMoney,
  fromDatabase,
  getCategoryRank,
  getRecentTrend,
  summarizeStats,
  todayISO,
  toDatabase,
} from "./utils.js";

const state = {
  user: null,
  records: [],
  filter: "all",
  query: "",
  type: "expense",
  syncing: false,
};

const el = {
  examCountdown: document.querySelector("#exam-countdown"),
  recordCount: document.querySelector("#record-count"),
  exportBtn: document.querySelector("#export-btn"),
  identityTitle: document.querySelector("#identity-title"),
  identitySubtitle: document.querySelector("#identity-subtitle"),
  avatar: document.querySelector("#avatar"),
  syncBtn: document.querySelector("#sync-btn"),
  loginBtn: document.querySelector("#login-btn"),
  loginBtnEmpty: document.querySelector("#login-btn-empty"),
  logoutBtn: document.querySelector("#logout-btn"),
  loginEmpty: document.querySelector("#login-empty"),
  dashboard: document.querySelector("#dashboard"),
  form: document.querySelector("#entry-form"),
  titleInput: document.querySelector("#title-input"),
  amountInput: document.querySelector("#amount-input"),
  categoryInput: document.querySelector("#category-input"),
  dateInput: document.querySelector("#date-input"),
  noteInput: document.querySelector("#note-input"),
  submitBtn: document.querySelector("#submit-btn"),
  segmentButtons: document.querySelectorAll(".segment"),
  filterButtons: document.querySelectorAll(".filter"),
  searchInput: document.querySelector("#search-input"),
  balance: document.querySelector("#balance"),
  balanceHint: document.querySelector("#balance-hint"),
  income: document.querySelector("#income"),
  expense: document.querySelector("#expense"),
  avgExpense: document.querySelector("#avg-expense"),
  categoryRank: document.querySelector("#category-rank"),
  trend: document.querySelector("#trend"),
  recordsList: document.querySelector("#records-list"),
  toast: document.querySelector("#toast"),
};

function boot() {
  el.examCountdown.textContent = `D-${daysUntil(EXAM_DATE)}`;
  el.dateInput.value = todayISO();
  renderCategoryOptions();
  bindEvents();

  if (!hasSupabaseConfig) {
    setStatus("未配置 Supabase 环境变量", "请复制 .env.example 为 .env.local，并填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
    render();
    return;
  }

  initAuth();
}

async function initAuth() {
  setSyncing(true);

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    state.user = data.session?.user || null;

    if (state.user) {
      await loadFromCloud(state.user.id);
    } else {
      setStatus("未登录，数据不会加载", "登录后才会读取或写入账本数据");
    }
  } catch (error) {
    showError(error, "登录状态检查失败");
  } finally {
    setSyncing(false);
    render();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    if (state.user) {
      loadFromCloud(state.user.id);
    } else {
      state.records = [];
      setStatus("未登录，数据不会加载", "登录后才会读取或写入账本数据");
      render();
    }
  });
}

function bindEvents() {
  el.loginBtn.addEventListener("click", signInWithGoogle);
  el.loginBtnEmpty.addEventListener("click", signInWithGoogle);
  el.logoutBtn.addEventListener("click", signOut);
  el.syncBtn.addEventListener("click", () => loadFromCloud());
  el.exportBtn.addEventListener("click", exportData);
  el.form.addEventListener("submit", submitRecord);

  el.segmentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.type;
      el.categoryInput.value = state.type === "income" ? "收入" : "餐饮";
      renderSegments();
    });
  });

  el.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderFilters();
      renderRecords();
    });
  });

  el.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderRecords();
  });
}

async function signInWithGoogle() {
  if (!hasSupabaseConfig) {
    showToast("缺少 Supabase 环境变量，无法登录");
    return;
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) showError(error, "Google 登录失败");
}

async function signOut() {
  if (!hasSupabaseConfig) return;
  setSyncing(true);

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    state.user = null;
    state.records = [];
    setStatus("已退出登录", "登录后才会读取或写入账本数据");
  } catch (error) {
    showError(error, "退出失败");
  } finally {
    setSyncing(false);
    render();
  }
}

async function loadFromCloud(userId = state.user?.id) {
  if (!hasSupabaseConfig || !userId) return;
  setSyncing(true);

  try {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("id,type,title,amount,category,entry_date,note,inserted_at")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .order("inserted_at", { ascending: false });

    if (error) throw error;
    state.records = (data || []).map(fromDatabase);
    setStatus(getDisplayName(), state.user?.email || "Google 登录已连接，数据来自 Supabase");
  } catch (error) {
    showError(error, "读取云端数据失败");
  } finally {
    setSyncing(false);
    render();
  }
}

async function submitRecord(event) {
  event.preventDefault();
  if (!state.user) {
    showToast("请先使用 Google 登录");
    return;
  }

  const amount = Number(el.amountInput.value);
  const title = el.titleInput.value.trim();
  if (!title || !Number.isFinite(amount) || amount <= 0) {
    showToast("标题和金额需要有效填写");
    return;
  }

  const record = {
    type: state.type,
    title,
    amount,
    category: el.categoryInput.value,
    date: el.dateInput.value,
    note: el.noteInput.value.trim(),
  };

  setSyncing(true);

  try {
    const { data, error } = await supabase
      .from("ledger_entries")
      .insert(toDatabase(record, state.user.id))
      .select("id,type,title,amount,category,entry_date,note")
      .single();

    if (error) throw error;
    state.records = [fromDatabase(data), ...state.records];
    resetForm();
    showToast("已写入 Supabase");
  } catch (error) {
    showError(error, "云端写入失败");
  } finally {
    setSyncing(false);
    render();
  }
}

async function removeRecord(id) {
  if (!state.user) return;
  const oldRecords = state.records;
  state.records = state.records.filter((record) => record.id !== id);
  render();
  setSyncing(true);

  try {
    const { error } = await supabase
      .from("ledger_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", state.user.id);

    if (error) throw error;
    showToast("云端记录已删除");
  } catch (error) {
    state.records = oldRecords;
    showError(error, "删除失败，已回滚");
  } finally {
    setSyncing(false);
    render();
  }
}

function render() {
  renderAuth();
  renderStats();
  renderCategoryRank();
  renderTrend();
  renderRecords();
  renderSegments();
  renderFilters();
}

function renderAuth() {
  const loggedIn = Boolean(state.user);
  el.recordCount.textContent = String(state.records.length);
  el.exportBtn.disabled = !loggedIn || state.records.length === 0;
  el.loginEmpty.classList.toggle("hidden", loggedIn);
  el.dashboard.classList.toggle("hidden", !loggedIn);
  el.loginBtn.classList.toggle("hidden", loggedIn);
  el.logoutBtn.classList.toggle("hidden", !loggedIn);
  el.syncBtn.classList.toggle("hidden", !loggedIn);
  el.submitBtn.disabled = state.syncing;

  if (state.user) {
    const avatarUrl = state.user.user_metadata?.avatar_url;
    if (avatarUrl) {
      el.avatar.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="Google avatar" />`;
    } else {
      el.avatar.textContent = initials(getDisplayName());
    }
  } else {
    el.avatar.textContent = hasSupabaseConfig ? "G" : "DB";
  }
}

function renderStats() {
  const stats = summarizeStats(state.records);
  el.balance.textContent = formatMoney(stats.balance);
  el.balanceHint.textContent = stats.balance >= 0 ? "预算没有失控" : "支出已超过收入";
  el.income.textContent = formatMoney(stats.income);
  el.expense.textContent = formatMoney(stats.expense);
  el.avgExpense.textContent = formatMoney(stats.avgExpense);
}

function renderCategoryRank() {
  const data = getCategoryRank(state.records);
  if (!data.length) {
    el.categoryRank.innerHTML = `<div class="empty">暂无支出数据</div>`;
    return;
  }

  el.categoryRank.innerHTML = data
    .map((item) => `
      <article class="rank-row">
        <div class="rank-row-top">
          <span>${escapeHtml(item.name)}</span>
          <span>${formatMoney(item.value)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${item.percent}%"></div></div>
      </article>
    `)
    .join("");
}

function renderTrend() {
  const data = getRecentTrend(state.records);
  el.trend.innerHTML = data
    .map((item) => `
      <div class="trend-col" title="${formatMoney(item.expense)}">
        <div class="trend-bar" style="height:${item.percent}%"></div>
        <div class="trend-label">${escapeHtml(item.key)}</div>
      </div>
    `)
    .join("");
}

function renderRecords() {
  const visible = state.records
    .filter((record) => state.filter === "all" || record.type === state.filter)
    .filter((record) => {
      const text = `${record.title} ${record.category} ${record.note}`.toLowerCase();
      return text.includes(state.query.trim().toLowerCase());
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!visible.length) {
    el.recordsList.innerHTML = `<div class="empty">没有匹配记录</div>`;
    return;
  }

  el.recordsList.innerHTML = visible.map((record) => renderRecord(record)).join("");
  el.recordsList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => removeRecord(button.dataset.deleteId));
  });
}

function renderRecord(record) {
  const sign = record.type === "income" ? "+" : "-";
  const icon = record.type === "income" ? "↙" : "↗";

  return `
    <article class="record-card">
      <div class="record-icon ${record.type}">${icon}</div>
      <div class="record-main">
        <div class="record-title-row">
          <strong>${escapeHtml(record.title)}</strong>
          <span class="chip">${escapeHtml(record.category)}</span>
        </div>
        <div class="record-meta">${escapeHtml(record.date)} · ${escapeHtml(record.note || "无备注")}</div>
      </div>
      <div class="record-amount ${record.type}">
        <div>${sign}${formatMoney(record.amount)}</div>
        <button class="delete-btn" type="button" data-delete-id="${escapeHtml(record.id)}">删除</button>
      </div>
    </article>
  `;
}

function renderSegments() {
  el.segmentButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.type === state.type);
  });
}

function renderFilters() {
  el.filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderCategoryOptions() {
  el.categoryInput.innerHTML = CATEGORIES.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  el.categoryInput.value = "餐饮";
}

function resetForm() {
  el.titleInput.value = "";
  el.amountInput.value = "";
  el.noteInput.value = "";
  el.dateInput.value = todayISO();
  el.categoryInput.value = state.type === "income" ? "收入" : "餐饮";
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

function setStatus(title, subtitle) {
  el.identityTitle.textContent = title;
  el.identitySubtitle.textContent = subtitle;
}

function setSyncing(value) {
  state.syncing = value;
  el.syncBtn.disabled = value;
  el.loginBtn.disabled = value || !hasSupabaseConfig;
  el.loginBtnEmpty.disabled = value || !hasSupabaseConfig;
  el.logoutBtn.disabled = value;
  el.submitBtn.disabled = value;
  el.submitBtn.textContent = value ? "同步中..." : "写入账本";
}

function getDisplayName() {
  return state.user?.user_metadata?.full_name || state.user?.email || "Google 用户";
}

function initials(text) {
  return String(text || "G").trim().slice(0, 2).toUpperCase();
}

function showError(error, fallback) {
  const message = error?.message || fallback;
  setStatus(fallback, message);
  showToast(message);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    el.toast.classList.add("hidden");
  }, 2800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

boot();
