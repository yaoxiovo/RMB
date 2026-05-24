import pg from "pg";

const { Pool } = pg;
let pool;
let schemaReady = false;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function getDatabaseUrl(context) {
  return context?.env?.DATABASE_URL || process.env.DATABASE_URL || "";
}

function getPool(context) {
  if (pool) return pool;

  const connectionString = getDatabaseUrl(context);
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  return pool;
}

async function ensureSchema(context) {
  if (schemaReady) return;
  const db = getPool(context);

  await db.query(`
    create extension if not exists pgcrypto;

    create table if not exists public.ledger_entries (
      id uuid primary key default gen_random_uuid(),
      type text not null check (type in ('income', 'expense')),
      title text not null,
      amount numeric(12, 2) not null check (amount > 0),
      category text not null,
      entry_date date not null,
      note text default '',
      inserted_at timestamptz not null default now()
    );

    create index if not exists ledger_entries_entry_date_idx
      on public.ledger_entries (entry_date desc, inserted_at desc);
  `);

  schemaReady = true;
}

function validateEntry(input) {
  const type = String(input?.type || "").trim();
  const title = String(input?.title || "").trim();
  const amount = Number(input?.amount);
  const category = String(input?.category || "其他").trim();
  const date = String(input?.date || input?.entry_date || "").trim();
  const note = String(input?.note || "").trim();

  if (!["income", "expense"].includes(type)) {
    throw new Error("type must be income or expense");
  }
  if (!title || title.length > 80) {
    throw new Error("title is required and must be at most 80 characters");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!category || category.length > 40) {
    throw new Error("category is required and must be at most 40 characters");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date must be yyyy-mm-dd");
  }
  if (note.length > 300) {
    throw new Error("note must be at most 300 characters");
  }

  return { type, title, amount, category, date, note };
}

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    entry_date: row.entry_date instanceof Date ? row.entry_date.toISOString().slice(0, 10) : row.entry_date,
    note: row.note || "",
    inserted_at: row.inserted_at,
  };
}

export async function onRequestGet(context) {
  try {
    await ensureSchema(context);
    const db = getPool(context);
    const { rows } = await db.query(`
      select id, type, title, amount, category, entry_date, note, inserted_at
      from public.ledger_entries
      order by entry_date desc, inserted_at desc
      limit 500
    `);
    return json({ entries: rows.map(mapRow) });
  } catch (error) {
    console.error("GET /api/entries failed", error);
    return json({ error: error.message || "db_read_failed" }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    await ensureSchema(context);
    const db = getPool(context);
    const body = await context.request.json();
    const entry = validateEntry(body);

    const { rows } = await db.query(
      `
      insert into public.ledger_entries (type, title, amount, category, entry_date, note)
      values ($1, $2, $3, $4, $5, $6)
      returning id, type, title, amount, category, entry_date, note, inserted_at
      `,
      [entry.type, entry.title, entry.amount, entry.category, entry.date, entry.note]
    );

    return json({ entry: mapRow(rows[0]) }, 201);
  } catch (error) {
    console.error("POST /api/entries failed", error);
    const message = error.message || "db_insert_failed";
    const status = message.includes("must") || message.includes("required") ? 400 : 500;
    return json({ error: message }, status);
  }
}

export async function onRequestDelete(context) {
  try {
    await ensureSchema(context);
    const db = getPool(context);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return json({ error: "valid id query parameter is required" }, 400);
    }

    const { rows } = await db.query(
      "delete from public.ledger_entries where id = $1 returning id",
      [id]
    );

    if (!rows.length) {
      return json({ error: "entry_not_found" }, 404);
    }

    return json({ ok: true, id: rows[0].id });
  } catch (error) {
    console.error("DELETE /api/entries failed", error);
    return json({ error: error.message || "db_delete_failed" }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
