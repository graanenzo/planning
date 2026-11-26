import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Gedeelde staat: ingelogde sessie, eigen medewerkersprofiel en alle medewerkers
export const ctx = { session: null, me: null, mw: [] };
export const isAdmin = () => ctx.me?.rol === 'beheerder';

export const AFD = { winkel: 'Winkel', restaurant: 'Restaurant', magazijn: 'Magazijn' };
export const AFD_LANG = { winkel: 'Graanenzo Winkel', restaurant: 'Graanenzo Restaurant', magazijn: 'Graanenzo Magazijn' };
export const AFD_KLASSE = { winkel: 'w', restaurant: 'r', magazijn: 'm' };
export const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- datums (alles in Europe/Amsterdam) ----------
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const parse = (iso) => new Date(iso + 'T12:00:00Z');
export const addDays = (iso, n) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const mondayOf = (iso) => { const d = parse(iso); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };
export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
export const fmtDay = (iso) => parse(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const fmtShort = (iso) => parse(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtRange = (monday) => {
  const e = addDays(monday, 6);
  const o = { day: 'numeric', month: 'long', timeZone: 'UTC' };
  return `${parse(monday).toLocaleDateString('nl-NL', { day: 'numeric', timeZone: 'UTC' })} - ${parse(e).toLocaleDateString('nl-NL', { ...o, year: 'numeric' })}`;
};
export const weekNr = (iso) => {
  const d = parse(iso); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - y0) / 86400000 + 1) / 7);
};
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
export const tsTime = (ts) => (ts ? new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) : '');
export const tsTimeSec = (ts) => (ts ? new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Amsterdam' }) : '');

// "13:00" op een Amsterdamse datum -> ISO-tijdstip
export function amsToISO(datum, tijd) {
  const guess = new Date(`${datum}T${tijd}:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(guess).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
  return new Date(guess.getTime() - (asUtc - guess.getTime())).toISOString();
}

export const minutes = (start, eind, pauze = 0) => {
  const m = (t) => { const [h, mi] = hhmm(t).split(':').map(Number); return h * 60 + mi; };
  return Math.max(0, m(eind) - m(start) - (pauze || 0));
};
export const fmtUren = (min) => `${(Math.round(min / 15) / 4).toString().replace('.', ',')}`;
export const tsMinutes = (r) => (r.uit_tijd ? Math.max(0, Math.round((new Date(r.uit_tijd) - new Date(r.in_tijd)) / 60000) - (r.pauze_minuten || 0)) : 0);

export const naamVan = (id) => ctx.mw.find((m) => m.id === id)?.naam ?? '?';
export const initialen = (naam) => naam.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const mijnAfdelingen = () => (isAdmin() ? Object.keys(AFD) : ctx.me?.afdelingen ?? []);

// ---------- ui ----------
let toastTimer;
export function toast(msg, fout = false) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show' + (fout ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = ''), fout ? 5000 : 2200);
}

// Voert een actie uit en toont een foutmelding in plaats van te crashen
export async function act(fn) {
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || String(e), true); return undefined; }
}
export function check({ data, error }) { if (error) throw new Error(error.message); return data; }

export function openModal(html, mount) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const overlay = root.firstElementChild;
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  mount?.(root.querySelector('.modal'), close);
  return close;
}

export const weekNav = (monday) => `
  <div class="weeknav hide-print">
    <button data-nav="-1" aria-label="Vorige week">‹</button>
    <span class="label">${fmtRange(monday)}</span>
    <button data-nav="0" title="Deze week">Vandaag</button>
    <button data-nav="1" aria-label="Volgende week">›</button>
  </div>`;

export function bindWeekNav(root, state, reload) {
  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.nav;
    state.monday = n === 0 ? mondayOf(today()) : addDays(state.monday, 7 * n);
    reload();
  }));
}

export const afdOptions = (selected, metAlle = false) =>
  (metAlle ? `<option value="">Alle afdelingen</option>` : '') +
  mijnAfdelingen().map((a) => `<option value="${a}" ${a === selected ? 'selected' : ''}>${AFD[a]}</option>`).join('');

export function downloadCsv(naam, rijen) {
  const csv = rijen.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = naam; a.click(); URL.revokeObjectURL(a.href);
}
