import pg from 'pg';
const { Pool } = pg;
let pool;
let ready = false;
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const body = async request => { try { return await request.json(); } catch { return {}; } };
export function db(context) {
  const url = context?.env?.DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  if (!pool) pool = new Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  return pool;
}
export async function schema(context) {
  if (ready) return;
  await db(context).query(`
    create extension if not exists pgcrypto;
    create table if not exists ledger_accounts(id uuid primary key default gen_random_uuid(),name text not null unique,kind text not null default 'asset',opening_balance numeric(12,2) not null default 0,sort_order int not null default 100,is_archived boolean not null default false,inserted_at timestamptz not null default now());
    create table if not exists ledger_tags(id uuid primary key default gen_random_uuid(),name text not null unique,color text not null default '#67e8f9',inserted_at timestamptz not null default now());
    create table if not exists ledger_entries(id uuid primary key default gen_random_uuid(),type text not null check(type in('income','expense')),title text not null,amount numeric(12,2) not null check(amount>0),category text not null,account_id uuid references ledger_accounts(id) on delete set null,rating text not null default '可接受',entry_date date not null,note text default '',inserted_at timestamptz not null default now());
    alter table ledger_entries add column if not exists account_id uuid references ledger_accounts(id) on delete set null;
    alter table ledger_entries add column if not exists rating text not null default '可接受';
    create table if not exists ledger_entry_tags(entry_id uuid not null references ledger_entries(id) on delete cascade,tag_id uuid not null references ledger_tags(id) on delete cascade,primary key(entry_id,tag_id));
    create table if not exists ledger_transfers(id uuid primary key default gen_random_uuid(),from_account_id uuid not null references ledger_accounts(id),to_account_id uuid not null references ledger_accounts(id),amount numeric(12,2) not null check(amount>0),transfer_date date not null,note text default '',inserted_at timestamptz not null default now(),check(from_account_id<>to_account_id));
    create table if not exists ledger_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
    create table if not exists ledger_recurring_bills(id uuid primary key default gen_random_uuid(),title text not null,type text not null check(type in('income','expense')),amount numeric(12,2) not null check(amount>0),category text not null,account_id uuid references ledger_accounts(id) on delete set null,interval_kind text not null default 'monthly' check(interval_kind in('daily','weekly','monthly')),next_date date not null,note text default '',is_active boolean not null default true,inserted_at timestamptz not null default now());
    insert into ledger_accounts(name,sort_order) values('微信',10),('支付宝',20),('银行卡',30),('现金',40),('其他存款',50) on conflict(name) do nothing;
    insert into ledger_tags(name,color) values('必要','#67e8f9'),('可省','#a78bfa'),('冲动消费','#fb7185'),('中考相关','#34d399'),('人情往来','#fbbf24') on conflict(name) do nothing;
    insert into ledger_settings(key,value) values('budget','{"monthlyBudget":0,"alertPercent":80,"lowBalanceThreshold":0}'::jsonb) on conflict(key) do nothing;
    update ledger_entries set account_id=(select id from ledger_accounts where name='现金' limit 1) where account_id is null;
  `);
  ready = true;
}
export const date = v => v instanceof Date ? v.toISOString().slice(0,10) : v;
export const entry = r => ({ id:r.id,type:r.type,title:r.title,amount:Number(r.amount),category:r.category,account_id:r.account_id,account_name:r.account_name,rating:r.rating,entry_date:date(r.entry_date),note:r.note||'',tags:(r.tags||[]).filter(Boolean),inserted_at:r.inserted_at });
export const account = r => ({ id:r.id,name:r.name,kind:r.kind,opening_balance:Number(r.opening_balance),sort_order:Number(r.sort_order),is_archived:!!r.is_archived,balance:Number(r.balance ?? r.opening_balance ?? 0) });
export const tag = r => ({ id:r.id,name:r.name,color:r.color });
export const transfer = r => ({ id:r.id,from_account_id:r.from_account_id,to_account_id:r.to_account_id,from_account_name:r.from_account_name,to_account_name:r.to_account_name,amount:Number(r.amount),transfer_date:date(r.transfer_date),note:r.note||'',inserted_at:r.inserted_at });
export const recurring = r => ({ id:r.id,title:r.title,type:r.type,amount:Number(r.amount),category:r.category,account_id:r.account_id,account_name:r.account_name,interval_kind:r.interval_kind,next_date:date(r.next_date),note:r.note||'',is_active:!!r.is_active });
export async function entriesQuery(client) { const {rows}=await client.query(`select e.*,a.name account_name,coalesce(json_agg(json_build_object('id',t.id,'name',t.name,'color',t.color)) filter(where t.id is not null),'[]') tags from ledger_entries e left join ledger_accounts a on a.id=e.account_id left join ledger_entry_tags et on et.entry_id=e.id left join ledger_tags t on t.id=et.tag_id group by e.id,a.name order by e.entry_date desc,e.inserted_at desc`); return rows.map(entry); }
export async function accountsQuery(client){const {rows}=await client.query(`select a.*,a.opening_balance+coalesce(sum(case when e.type='income' then e.amount when e.type='expense' then -e.amount else 0 end),0)+coalesce((select sum(amount) from ledger_transfers where to_account_id=a.id),0)-coalesce((select sum(amount) from ledger_transfers where from_account_id=a.id),0) balance from ledger_accounts a left join ledger_entries e on e.account_id=a.id group by a.id order by a.sort_order,a.inserted_at`);return rows.map(account)}
export async function state(context){await schema(context);const c=db(context);const [entries,accounts,tags,settings,transfers,recurringBills]=await Promise.all([entriesQuery(c),accountsQuery(c),c.query('select * from ledger_tags order by inserted_at').then(x=>x.rows.map(tag)),c.query(`select value from ledger_settings where key='budget'`).then(x=>x.rows[0]?.value||{}),c.query(`select tr.*,fa.name from_account_name,ta.name to_account_name from ledger_transfers tr join ledger_accounts fa on fa.id=tr.from_account_id join ledger_accounts ta on ta.id=tr.to_account_id order by transfer_date desc,inserted_at desc`).then(x=>x.rows.map(transfer)),c.query(`select r.*,a.name account_name from ledger_recurring_bills r left join ledger_accounts a on a.id=r.account_id order by next_date`).then(x=>x.rows.map(recurring))]);return {entries,accounts,tags,settings,transfers,recurring:recurringBills}}
export function nextDate(d,kind){const x=new Date(d); if(kind==='daily')x.setDate(x.getDate()+1); else if(kind==='weekly')x.setDate(x.getDate()+7); else x.setMonth(x.getMonth()+1); return x.toISOString().slice(0,10)}
