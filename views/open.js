import { sb, ctx, isAdmin, esc, act, check, toast, today, addDays, fmtDay, hhmm, minutes, AFD, AFD_LANG, afdOptions } from '../lib.js';

const state = { alleenMijn: false, afd: '' };

export async function openShiftsView(el) {
  const van = today();
  const shifts = check(await sb.rpc('shifts_met_bezetting', { p_van: van, p_tot: addDays(van, 90) }));

  const zichtbaar = shifts.filter((s) =>
    (!state.afd || s.afdeling === state.afd) &&
    (state.alleenMijn ? s.mijn_status : isAdmin() || true));

  const perDag = new Map();
  zichtbaar.forEach((s) => perDag.set(s.datum, [...(perDag.get(s.datum) ?? []), s]));

  const mijnAantal = shifts.filter((s) => s.mijn_status).length;
  el.innerHTML = `<div class="wrap narrow">
    <div class="crumbs"><a href="#/">Dashboard</a> › Open shifts</div>
    <h1>Open shifts</h1><p class="sub">Claim beschikbare open shifts. Een beheerder keurt je aanmelding goed.</p>
    <div class="row">
      <label class="btn row" style="gap:8px;cursor:pointer"><input type="checkbox" id="mijn" ${state.alleenMijn ? 'checked' : ''}> Mijn geclaimde shifts (${mijnAantal})</label>
      <select id="afd">${afdOptions(state.afd, true)}</select>
    </div>
    ${perDag.size ? [...perDag].map(([datum, lijst]) => `
      <div class="day-h">${esc(fmtDay(datum))}</div>
      ${lijst.map(kaart).join('')}`).join('') : `<div class="card empty" style="margin-top:20px">${state.alleenMijn ? 'Je hebt nog geen shifts geclaimd.' : 'Er zijn geen open shifts.'}</div>`}
    <p class="note" style="text-align:center;margin-top:28px">Alle open shifts zijn geladen</p>
  </div>`;

  el.querySelector('#mijn').addEventListener('change', (e) => { state.alleenMijn = e.target.checked; openShiftsView(el); });
  el.querySelector('#afd').addEventListener('change', (e) => { state.afd = e.target.value; openShiftsView(el); });
  el.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => act(async () => {
    b.disabled = true;
    check(await sb.rpc('shift_aanmelden', { p_shift_id: b.dataset.claim }));
    toast('Aangemeld. Wacht op goedkeuring van de beheerder.'); openShiftsView(el);
  }).finally(() => { b.disabled = false; })));
  el.querySelectorAll('[data-intrekken]').forEach((b) => b.addEventListener('click', () => act(async () => {
    check(await sb.rpc('shift_intrekken', { p_shift_id: b.dataset.intrekken }));
    toast('Aanmelding ingetrokken'); openShiftsView(el);
  })));
}

function kaart(s) {
  const vrij = s.plekken - s.bezet;
  const uren = minutes(s.start_tijd, s.eind_tijd, s.pauze_minuten);
  let rechts = '';
  let status = '';
  if (s.mijn_status === 'goedgekeurd') {
    status = '<span class="pill green">Jij werkt deze shift</span>';
  } else if (s.mijn_status === 'aangemeld') {
    status = '<span class="pill orange">Wacht op goedkeuring</span>';
    rechts = `<button class="btn" data-intrekken="${s.id}">Intrekken</button>`;
  } else if (s.mijn_status === 'afgekeurd') {
    rechts = vrij > 0 ? `<button class="btn primary" data-claim="${s.id}">Opnieuw claimen</button>` : '';
    status = `<span class="pill red">Afgekeurd</span>${vrij <= 0 ? '<span class="pill">Volledig bezet</span>' : ''}`;
  } else if (vrij <= 0) {
    status = '<span class="pill">Volledig bezet</span>';
  } else if (s.gepubliceerd) {
    status = `<span class="pill blue">${vrij} ${vrij === 1 ? 'plek' : 'plekken'} beschikbaar</span>`;
    rechts = `<button class="btn primary" data-claim="${s.id}" style="min-width:150px">Claimen</button>`;
  }
  return `<div class="card shift ${s.mijn_status === 'afgekeurd' ? 'red' : ''}">
    <div><div class="time">${hhmm(s.start_tijd)} - ${hhmm(s.eind_tijd)}</div>
      <div class="meta"><span class="pill">${s.pauze_minuten} min pauze</span><span class="pill">${fmtUrenKort(uren)} uur</span>${!s.gepubliceerd ? '<span class="pill orange">Concept</span>' : ''}</div>
      <div class="meta"><span>📍 ${AFD_LANG[s.afdeling]}</span>${status}</div>
      ${s.titel || s.opmerking ? `<div class="meta">${esc([s.titel, s.opmerking].filter(Boolean).join(' · '))}</div>` : ''}
    </div>${rechts}</div>`;
}

const fmtUrenKort = (min) => (Math.round(min / 15) / 4).toString().replace('.', ',');
