import { json, state } from '../_lib/db.js';
export async function onRequestGet({ context }) { try { return json(await state(context)); } catch (e) { return json({ error: e.message }, 500); } }
