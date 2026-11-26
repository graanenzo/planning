import {
  sb, ctx, isAdmin, esc, act, check, toast, today, mondayOf, addDays, weekDays, DAGEN, hhmm, minutes, fmtUren, fmtDay, fmtRange, weekNr,
  weekNav, bindWeekNav, openModal, naamVan, initialen, AFD, AFD_KLASSE, afdOptions, downloadCsv,
} from '../lib.js';

const state = { monday: mondayOf(today()), afd: '' };

export async function roosterView(el) {
  const dagen = weekDays(state.monday);
  const admin = isAdmin();
  const [shifts, diensten, beschik] = await Promise.all([
    sb.rpc('shifts_met_bezetting', { p_van: dagen[0], p_tot: dagen[6] }),
    sb.from('diensten').select('*').gte('datum', dagen[0]).lte('datum', dagen[6]).order('start_tijd'),
    admin ? sb.from('beschikbaarheid').select('*').gte('datum', dagen[0]).lte('datum', dagen[6]) : { data: [], error: null },
  ]);
  const S = check(shifts).filter((s) => !state.afd || s.afdeling === state.afd);
  const D = check(diensten).filter((d) => !state.afd || d.afdeling === state.afd);
  const B = check(beschik);

  const dienstMin = D.reduce((n, d) => n + minutes(d.start_tijd, d.eind_tijd, d.pauze_minuten), 0);
  const openMin = S.reduce((n, s) => n + Math.max(0, s.plekken - s.bezet) * minutes(s.start_tijd, s.eind_tijd, s.pauze_minuten), 0);
  const concept = S.filter((s) => !s.gepubliceerd).length + D.filter((d) => !d.gepubliceerd).length;

  const mensen = ctx.mw.filter((m) => m.actief && (admin ? (!state.afd || m.afdelingen.includes(state.afd)) : D.some((d) => d.medewerker_id === m.id)));

  const shiftChip = (s) => {
    const vol = s.bezet >= s.plekken;
    return `<button class="chip ${AFD_KLASSE[s.afdeling]} ${s.gepubliceerd ? '' : 'draft'}" data-shift="${s.id}">
      ${hhmm(s.start_tijd)} - ${hhmm(s.eind_tijd)}
      <small>${AFD[s.afdeling]} · <b style="color:${vol ? 'var(--green)' : 'var(--orange)'}">${s.bezet}/${s.plekken}</b>${s.aangemeld ? ` · <b style="color:var(--blue-d)">${s.aangemeld} aanvr.</b>` : ''}${s.gepubliceerd ? '' : ' · concept'}</small></button>`;
  };
  const dienstChip = (d) => `<button class="chip ${AFD_KLASSE[d.afdeling]} ${d.gepubliceerd ? '' : 'draft'}" data-dienst="${d.id}" ${admin ? '' : 'style="cursor:default"'}>
      ${hhmm(d.start_tijd)} - ${hhmm(d.eind_tijd)}<small>${AFD[d.afdeling]}${d.gepubliceerd ? '' : ' · concept'}</small></button>`;

  const kop = dagen.map((d, i) => `<th class="${d === today() ? 'today' : ''}">${DAGEN[i]} ${+d.slice(8)}</th>`).join('');
  const openRij = admin ? `<tr><td class="name"><div class="person"><span class="avatar" style="background:#e2e8f0;color:#475569">👥</span><div><b>Open shifts</b><small>${S.filter((s) => s.bezet < s.plekken).length} open</small></div></div></td>
    ${dagen.map((d) => `<td class="${d === today() ? 'today' : ''}"><div class="cell">${S.filter((s) => s.datum === d).map(shiftChip).join('')}
      <button class="addbtn hide-print" data-nieuw="${d}" title="Shift toevoegen">+</button></div></td>`).join('')}</tr>` : '';

  const persoonRij = (m) => {
    const mijnD = D.filter((d) => d.medewerker_id === m.id);
    const min = mijnD.reduce((n, d) => n + minutes(d.start_tijd, d.eind_tijd, d.pauze_minuten), 0);
    return `<tr><td class="name"><div class="person"><span class="avatar">${initialen(m.naam)}</span><div>${esc(m.naam)}<small>${fmtUren(min)} u</small></div></div></td>
      ${dagen.map((d) => {
        const b = B.find((x) => x.medewerker_id === m.id && x.datum === d);
        return `<td class="${d === today() ? 'today' : ''}"><div class="cell">${b ? `<span class="dot ${b.status}" title="${b.status === 'deels' ? `${hhmm(b.van)} - ${hhmm(b.tot)}` : b.status}"></span>` : ''}
          ${mijnD.filter((x) => x.datum === d).map(dienstChip).join('')}
          ${admin ? `<button class="addbtn hide-print" data-persoon="${m.id}" data-datum="${d}" title="Dienst toevoegen">+</button>` : ''}</div></td>`;
      }).join('')}</tr>`;
  };

  el.innerHTML = `<div class="wrap wide">
    <div class="crumbs hide-print"><a href="#/">Dashboard</a> › ${admin ? 'Rooster maken' : 'Rooster'}</div>
    <div class="row between" style="margin-bottom:12px">
      <div><h1>${admin ? 'Rooster maken' : 'Rooster'} <span class="pill">Week ${weekNr(state.monday)}</span></h1><p class="sub" style="margin:0">${fmtRange(state.monday)}</p></div>
      <div class="row">
        <select id="afd" class="hide-print">${afdOptions(state.afd, true)}</select>
        ${weekNav(state.monday)}
      </div></div>
    <div class="row between hide-print" style="margin-bottom:10px">
      <div><b>${fmtUren(dienstMin)} uur</b> ingepland${admin ? ` · <span class="note">${fmtUren(openMin)} uur open</span>` : ''}</div>
      ${admin ? `<div class="row">
        <button class="btn" id="kopieer">Vorige week kopiëren</button>
        <button class="btn primary" id="publiceer" ${concept ? '' : 'disabled'}>Publiceren${concept ? ` (${concept})` : ''}</button>
        <button class="btn" id="print">Afdrukken</button>
        <button class="btn" id="csv">CSV</button></div>` : ''}
    </div>
    <div class="gridwrap"><table class="grid"><thead><tr><th class="name"></th>${kop}</tr></thead>
      <tbody>${openRij}${mensen.map(persoonRij).join('')}</tbody></table></div>
    ${!admin && !mensen.length ? '<div class="empty">Er zijn deze week nog geen diensten gepubliceerd.</div>' : ''}
  </div>`;

  const herlaad = () => roosterView(el);
  bindWeekNav(el, state, herlaad);
  el.querySelector('#afd').addEventListener('change', (e) => { state.afd = e.target.value; herlaad(); });
  if (!admin) return;

  el.querySelectorAll('[data-nieuw]').forEach((b) => b.addEventListener('click', () => shiftModal({ datum: b.dataset.nieuw }, herlaad)));
  el.querySelectorAll('[data-shift]').forEach((b) => b.addEventListener('click', () => shiftModal(S.find((s) => s.id === b.dataset.shift), herlaad)));
  el.querySelectorAll('[data-dienst]').forEach((b) => b.addEventListener('click', () => {
    const d = D.find((x) => x.id === b.dataset.dienst);
    const s = d.shift_id && S.find((x) => x.id === d.shift_id);
    s ? shiftModal(s, herlaad) : dienstModal(d, herlaad);
  }));
  el.querySelectorAll('[data-persoon]').forEach((b) => b.addEventListener('click', () => persoonDienstModal(b.dataset.persoon, b.dataset.datum, herlaad)));

  el.querySelector('#print').addEventListener('click', () => window.print());
  el.querySelector('#csv').addEventListener('click', () => downloadCsv(`rooster-week-${weekNr(state.monday)}.csv`,
    [['Medewerker', 'Datum', 'Afdeling', 'Start', 'Eind', 'Pauze (min)', 'Uren'],
      ...D.map((d) => [naamVan(d.medewerker_id), d.datum, AFD[d.afdeling], hhmm(d.start_tijd), hhmm(d.eind_tijd), d.pauze_minuten, fmtUren(minutes(d.start_tijd, d.eind_tijd, d.pauze_minuten))])]));

  el.querySelector('#publiceer').addEventListener('click', () => act(async () => {
    const n = check(await sb.rpc('rooster_publiceren', { p_van: dagen[0], p_tot: dagen[6], p_afdeling: state.afd || null }));
    toast(`Gepubliceerd (${n} onderdelen)`); herlaad();
  }));

  el.querySelector('#kopieer').addEventListener('click', () => act(async () => {
    const vorige = weekDays(addDays(state.monday, -7));
    const oud = check(await sb.rpc('shifts_met_bezetting', { p_van: vorige[0], p_tot: vorige[6] })).filter((s) => !state.afd || s.afdeling === state.afd);
    const sleutel = (s, datum) => [s.afdeling, datum, hhmm(s.start_tijd), hhmm(s.eind_tijd)].join('|');
    const bestaand = new Set(check(await sb.rpc('shifts_met_bezetting', { p_van: dagen[0], p_tot: dagen[6] })).map((s) => sleutel(s, s.datum)));
    const nieuw = oud.filter((s) => !bestaand.has(sleutel(s, addDays(s.datum, 7))));
    if (!nieuw.length) return toast('Er is niets om te kopiëren');
    if (!confirm(`${nieuw.length} shifts van vorige week kopiëren als concept? Aanmeldingen en toewijzingen worden niet meegenomen.`)) return;
    check(await sb.from('shifts').insert(nieuw.map((s) => ({
      afdeling: s.afdeling, datum: addDays(s.datum, 7), start_tijd: s.start_tijd, eind_tijd: s.eind_tijd, pauze_minuten: s.pauze_minuten,
      plekken: s.plekken, titel: s.titel, opmerking: s.opmerking, gepubliceerd: false, aangemaakt_door: ctx.me.id,
    }))));
    toast(`${nieuw.length} shifts gekopieerd`); herlaad();
  }));
}

// ---------- modals ----------
const veldenHtml = (s, medewerkers = false) => `
  <div class="two">
    <div><label class="f">Afdeling</label><select id="f-afd">${afdOptions(s.afdeling)}</select></div>
    <div><label class="f">Datum</label><input type="date" id="f-datum" value="${s.datum ?? ''}"></div>
  </div>
  <div class="two">
    <div><label class="f">Start</label><input type="time" id="f-start" value="${hhmm(s.start_tijd) || '09:00'}"></div>
    <div><label class="f">Eind</label><input type="time" id="f-eind" value="${hhmm(s.eind_tijd) || '17:00'}"></div>
  </div>
  <div class="two">
    <div><label class="f">Pauze (min)</label><input type="number" id="f-pauze" min="0" max="480" value="${s.pauze_minuten ?? 30}"></div>
    ${medewerkers ? '' : `<div><label class="f">Aantal plekken</label><input type="number" id="f-plekken" min="1" max="50" value="${s.plekken ?? 1}"></div>`}
  </div>`;

const leesVelden = (m) => {
  const v = (id) => m.querySelector(id)?.value;
  const r = { afdeling: v('#f-afd'), datum: v('#f-datum'), start_tijd: v('#f-start'), eind_tijd: v('#f-eind'), pauze_minuten: +v('#f-pauze') || 0 };
  if (!r.datum) throw new Error('Kies een datum');
  if (!r.start_tijd || !r.eind_tijd || r.eind_tijd <= r.start_tijd) throw new Error('De eindtijd moet na de starttijd liggen');
  return r;
};

function shiftModal(s, herlaad) {
  const bestaand = !!s.id;
  openModal(`<h3>${bestaand ? 'Shift' : 'Nieuwe shift'}</h3>
    <p class="sub" style="margin:0">${s.datum ? esc(fmtDay(s.datum)) : ''}${bestaand && !s.gepubliceerd ? ' · concept' : ''}</p>
    ${veldenHtml(s)}
    <label class="f">Titel (optioneel)</label><input id="f-titel" value="${esc(s.titel ?? '')}">
    <label class="f">Opmerking (optioneel)</label><input id="f-opm" value="${esc(s.opmerking ?? '')}">
    ${bestaand ? '<div id="aanm"></div>' : ''}
    <div class="actions">
      ${bestaand ? '<button class="btn danger" id="del" style="margin-right:auto">Shift verwijderen</button>' : ''}
      <button class="btn" data-close>Sluiten</button><button class="btn primary" id="save">Opslaan</button></div>`,
  (m, close) => {
    m.querySelector('#save').addEventListener('click', () => act(async () => {
      const rij = { ...leesVelden(m), plekken: +m.querySelector('#f-plekken').value || 1, titel: m.querySelector('#f-titel').value.trim() || null, opmerking: m.querySelector('#f-opm').value.trim() || null };
      if (bestaand) {
        const bezet = s.bezet ?? 0;
        if (rij.plekken < bezet) throw new Error(`Er zijn al ${bezet} mensen ingepland; zet het aantal plekken niet lager.`);
        check(await sb.from('shifts').update(rij).eq('id', s.id));
        check(await sb.from('diensten').update({ afdeling: rij.afdeling, datum: rij.datum, start_tijd: rij.start_tijd, eind_tijd: rij.eind_tijd, pauze_minuten: rij.pauze_minuten }).eq('shift_id', s.id));
      } else {
        check(await sb.from('shifts').insert({ ...rij, gepubliceerd: false, aangemaakt_door: ctx.me.id }));
      }
      toast('Opgeslagen'); close(); herlaad();
    }));
    if (!bestaand) return;
    m.querySelector('#del').addEventListener('click', () => act(async () => {
      if (!confirm('Deze shift en alle bijbehorende diensten en aanmeldingen verwijderen?')) return;
      check(await sb.from('shifts').delete().eq('id', s.id));
      toast('Shift verwijderd'); close(); herlaad();
    }));
    aanmeldingenLijst(m.querySelector('#aanm'), s, () => { close(); herlaad(); });
  });
}

async function aanmeldingenLijst(box, s, klaar) {
  const rijen = check(await sb.from('shift_aanmeldingen').select('*').eq('shift_id', s.id).order('aangemaakt_op'));
  const goed = rijen.filter((r) => r.status === 'goedgekeurd');
  const kandidaten = ctx.mw.filter((x) => x.actief && x.afdelingen.includes(s.afdeling) && !goed.some((g) => g.medewerker_id === x.id));
  const pill = { aangemeld: '<span class="pill orange">Aangemeld</span>', goedgekeurd: '<span class="pill green">Ingepland</span>', afgekeurd: '<span class="pill red">Afgekeurd</span>' };
  box.innerHTML = `<h2 style="font-size:16px">Bezetting (${goed.length}/${s.plekken})</h2>
    ${rijen.length ? rijen.map((r) => `<div class="arow"><span class="avatar">${initialen(naamVan(r.medewerker_id))}</span>
      <span class="grow">${esc(naamVan(r.medewerker_id))}${r.opmerking ? `<br><span class="note">${esc(r.opmerking)}</span>` : ''}</span>${pill[r.status]}
      ${r.status !== 'goedgekeurd' ? `<button class="btn sm ok" data-oke="${r.id}">Goedkeuren</button>` : ''}
      ${r.status === 'aangemeld' ? `<button class="btn sm danger" data-nee="${r.id}">Afkeuren</button>` : ''}
      ${r.status === 'goedgekeurd' ? `<button class="btn sm danger" data-weg="${r.medewerker_id}">Verwijderen</button>` : ''}</div>`).join('')
      : '<p class="note">Nog niemand aangemeld of ingepland.</p>'}
    <div class="row" style="margin-top:10px"><select id="toew" class="grow"><option value="">Medewerker toewijzen…</option>
      ${kandidaten.map((k) => `<option value="${k.id}">${esc(k.naam)}</option>`).join('')}</select>
      <button class="btn" id="toewbtn">Toewijzen</button></div>`;
  const doe = (fn, msg) => act(async () => { await fn(); toast(msg); klaar(); });
  box.querySelectorAll('[data-oke]').forEach((b) => b.addEventListener('click', () => doe(async () => check(await sb.rpc('aanmelding_beoordelen', { p_id: b.dataset.oke, p_goedkeuren: true })), 'Goedgekeurd')));
  box.querySelectorAll('[data-nee]').forEach((b) => b.addEventListener('click', () => doe(async () => check(await sb.rpc('aanmelding_beoordelen', { p_id: b.dataset.nee, p_goedkeuren: false })), 'Afgekeurd')));
  box.querySelectorAll('[data-weg]').forEach((b) => b.addEventListener('click', () => doe(async () => check(await sb.rpc('aanmelding_verwijderen', { p_shift_id: s.id, p_medewerker_id: b.dataset.weg })), 'Verwijderd uit shift')));
  box.querySelector('#toewbtn').addEventListener('click', () => {
    const id = box.querySelector('#toew').value;
    if (id) doe(async () => check(await sb.rpc('shift_toewijzen', { p_shift_id: s.id, p_medewerker_id: id })), 'Toegewezen');
  });
}

// Eén medewerker een dienst geven: maakt een shift met 1 plek en wijst die meteen toe
function persoonDienstModal(medewerkerId, datum, herlaad) {
  const m0 = ctx.mw.find((x) => x.id === medewerkerId);
  openModal(`<h3>Dienst voor ${esc(m0.naam)}</h3><p class="sub" style="margin:0">${esc(fmtDay(datum))}</p>
    ${veldenHtml({ datum }, true).replace(/<select id="f-afd">.*?<\/select>/s, `<select id="f-afd">${m0.afdelingen.map((a) => `<option value="${a}">${AFD[a]}</option>`).join('')}</select>`)}
    <div class="actions"><button class="btn" data-close>Annuleren</button><button class="btn primary" id="save">Toevoegen</button></div>`,
  (m, close) => m.querySelector('#save').addEventListener('click', () => act(async () => {
    const rij = leesVelden(m);
    const nieuw = check(await sb.from('shifts').insert({ ...rij, plekken: 1, gepubliceerd: false, aangemaakt_door: ctx.me.id }).select().single());
    try { check(await sb.rpc('shift_toewijzen', { p_shift_id: nieuw.id, p_medewerker_id: medewerkerId })); }
    catch (e) { await sb.from('shifts').delete().eq('id', nieuw.id); throw e; }
    toast('Dienst toegevoegd (concept tot je publiceert)'); close(); herlaad();
  })));
}

// Dienst zonder shift (uit een eerdere versie): alleen verwijderen
function dienstModal(d, herlaad) {
  openModal(`<h3>Dienst van ${esc(naamVan(d.medewerker_id))}</h3>
    <p>${esc(fmtDay(d.datum))}<br>${hhmm(d.start_tijd)} - ${hhmm(d.eind_tijd)} · ${AFD[d.afdeling]}</p>
    <div class="actions"><button class="btn danger" id="del" style="margin-right:auto">Verwijderen</button><button class="btn" data-close>Sluiten</button></div>`,
  (m, close) => m.querySelector('#del').addEventListener('click', () => act(async () => {
    check(await sb.from('diensten').delete().eq('id', d.id)); toast('Verwijderd'); close(); herlaad();
  })));
}
