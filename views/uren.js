import {
  sb, ctx, isAdmin, esc, act, check, toast, today, mondayOf, addDays, weekDays, fmtDay, fmtUren, tsMinutes, tsTime, tsTimeSec, amsToISO,
  weekNr, weekNav, bindWeekNav, openModal, naamVan, initialen, AFD, afdOptions, mijnAfdelingen, downloadCsv, fmtShort,
} from '../lib.js';

const state = { monday: mondayOf(today()), afd: '', tab: 'alle' };

export const urenView = (el) => (isAdmin() ? beheerUren(el) : eigenUren(el));

const statusPill = (r) => {
  if (!r.uit_tijd) return '<span class="pill blue">Ingeklokt</span>';
  if (r.status === 'goedgekeurd') return '<span class="pill green">Goedgekeurd</span>';
  if (r.status === 'afgekeurd') return '<span class="pill red">Afgekeurd</span>';
  return '<span class="pill orange">Beoordelen</span>';
};

// ====================== beheerder: uren beoordelen ======================
async function beheerUren(el) {
  const dagen = weekDays(state.monday);
  const alle = check(await sb.from('kloktijden').select('*').gte('datum', dagen[0]).lte('datum', dagen[6]).order('in_tijd'));
  const rijen = alle.filter((r) => (!state.afd || r.afdeling === state.afd)
    && (state.tab === 'alle' || (state.tab === 'open' ? r.status === 'te_beoordelen' : r.status !== 'te_beoordelen')));
  const nogTeDoen = alle.filter((r) => r.status === 'te_beoordelen' && r.uit_tijd && (!state.afd || r.afdeling === state.afd));

  const rij = (r) => `<tr data-id="${r.id}">
    <td><div class="person"><span class="avatar">${initialen(naamVan(r.medewerker_id))}</span><div>${esc(naamVan(r.medewerker_id))}
      <div class="ingest ${r.bron === 'klok' ? 'ok' : ''}">${r.bron === 'klok' ? 'Ingeklokt' : 'Uren ingestuurd'}${r.afdeling ? ' · ' + AFD[r.afdeling] : ''}</div></div></div></td>
    <td><input type="time" data-f="in" value="${tsTime(r.in_tijd)}">${r.gecorrigeerd_op ? `<div class="note">Exact: ${tsTimeSec(r.in_oorspronkelijk ?? r.in_tijd)}</div>` : ''}</td>
    <td>${r.uit_tijd ? `<input type="time" data-f="uit" value="${tsTime(r.uit_tijd)}">${r.gecorrigeerd_op ? `<div class="note">Exact: ${tsTimeSec(r.uit_oorspronkelijk ?? r.uit_tijd)}</div>` : ''}` : '<span class="note">nog ingeklokt</span>'}</td>
    <td><input type="number" min="0" max="480" data-f="pauze" value="${r.pauze_minuten}" style="width:70px"> min</td>
    <td>${r.uit_tijd ? fmtUren(tsMinutes(r)) + ' uur' : '—'}</td>
    <td>${statusPill(r)}${r.beoordeel_opmerking ? `<div class="note">${esc(r.beoordeel_opmerking)}</div>` : ''}</td>
    <td style="white-space:nowrap">${r.uit_tijd ? (r.status === 'goedgekeurd'
      ? '<button class="btn sm" data-reset>Terugzetten</button>'
      : '<button class="btn sm ok" data-ok>✓</button> <button class="btn sm danger" data-nee>✕</button>') : ''}</td></tr>`;

  const dagBlok = (d) => {
    const lijst = rijen.filter((r) => r.datum === d);
    const goed = lijst.filter((r) => r.status === 'goedgekeurd').reduce((n, r) => n + tsMinutes(r), 0);
    return `<div class="daybox"><div class="dayhead"><div><b style="text-transform:capitalize">${esc(fmtDay(d).split(' ')[0])}</b> ${d.split('-').reverse().join('-')}</div>
      <button class="btn sm hide-print" data-add="${d}">+ Uren toevoegen</button></div>
      <div class="body">${lijst.length ? `<table class="tbl"><thead><tr><th>Medewerker</th><th>Start</th><th>Einde</th><th>Pauze</th><th>Uur</th><th>Status</th><th></th></tr></thead>
        <tbody>${lijst.map(rij).join('')}</tbody></table><div style="text-align:right;padding:6px 8px"><b>Goedgekeurd: ${fmtUren(goed)} uur</b></div>`
        : '<div class="empty">Deze dag bevat nog geen uren</div>'}</div></div>`;
  };

  el.innerHTML = `<div class="wrap wide" style="max-width:1100px">
    <div class="crumbs hide-print"><a href="#/">Dashboard</a> › Urenregistratie</div>
    <h1>Urenregistratie</h1><p class="sub">Week ${weekNr(state.monday)}</p>
    <div class="row between hide-print" style="margin-bottom:16px">
      <div class="tabs"><button data-tab="alle" class="${state.tab === 'alle' ? 'on' : ''}">Alle</button>
        <button data-tab="open" class="${state.tab === 'open' ? 'on' : ''}">Nog beoordelen (${nogTeDoen.length})</button>
        <button data-tab="klaar" class="${state.tab === 'klaar' ? 'on' : ''}">Beoordeeld</button></div>
      <div class="row"><select id="afd">${afdOptions(state.afd, true)}</select>${weekNav(state.monday)}
        <button class="btn primary" id="alles" ${nogTeDoen.length ? '' : 'disabled'}>Alles goedkeuren</button>
        <button class="btn" id="csv">Exporteren</button></div></div>
    ${dagen.map(dagBlok).join('')}</div>`;

  const herlaad = () => beheerUren(el);
  bindWeekNav(el, state, herlaad);
  el.querySelector('#afd').addEventListener('change', (e) => { state.afd = e.target.value; herlaad(); });
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; herlaad(); }));
  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => urenToevoegenModal(b.dataset.add, herlaad)));

  const beoordeel = (id, status, opm) => act(async () => { check(await sb.rpc('uren_beoordelen', { p_id: id, p_status: status, p_opmerking: opm ?? null })); herlaad(); });
  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('[data-ok]')?.addEventListener('click', () => beoordeel(id, 'goedgekeurd'));
    tr.querySelector('[data-nee]')?.addEventListener('click', () => { const opm = prompt('Reden van afkeuren (optioneel):'); if (opm !== null) beoordeel(id, 'afgekeurd', opm); });
    tr.querySelector('[data-reset]')?.addEventListener('click', () => beoordeel(id, 'te_beoordelen'));
    // tijden/pauze aanpassen: alleen opslaan als er iets verandert
    tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', () => act(async () => {
      const r = alle.find((x) => x.id === id);
      const inT = tr.querySelector('[data-f=in]').value, uitEl = tr.querySelector('[data-f=uit]');
      const pauze = +tr.querySelector('[data-f=pauze]').value || 0;
      if (!inT) throw new Error('Vul een starttijd in');
      const upd = { in_tijd: amsToISO(r.datum, inT), pauze_minuten: pauze };
      if (uitEl) {
        if (!uitEl.value) throw new Error('Vul een eindtijd in');
        upd.uit_tijd = amsToISO(r.datum, uitEl.value);
        if (new Date(upd.uit_tijd) <= new Date(upd.in_tijd)) throw new Error('De eindtijd moet na de starttijd liggen');
      }
      if (inT === tsTime(r.in_tijd) && (!uitEl || uitEl.value === tsTime(r.uit_tijd)) && pauze === r.pauze_minuten) return;
      upd.in_oorspronkelijk = r.in_oorspronkelijk ?? r.in_tijd;
      upd.uit_oorspronkelijk = r.uit_oorspronkelijk ?? r.uit_tijd;
      check(await sb.from('kloktijden').update(upd).eq('id', id));
      toast('Tijden aangepast'); herlaad();
    })));
  });

  el.querySelector('#alles').addEventListener('click', () => act(async () => {
    if (!confirm(`${nogTeDoen.length} registraties goedkeuren?`)) return;
    for (const r of nogTeDoen) check(await sb.rpc('uren_beoordelen', { p_id: r.id, p_status: 'goedgekeurd', p_opmerking: null }));
    toast('Alles goedgekeurd'); herlaad();
  }));
  el.querySelector('#csv').addEventListener('click', () => downloadCsv(`uren-week-${weekNr(state.monday)}.csv`,
    [['Medewerker', 'Datum', 'Afdeling', 'Start', 'Einde', 'Pauze (min)', 'Uren', 'Status'],
      ...alle.filter((r) => !state.afd || r.afdeling === state.afd).map((r) => [naamVan(r.medewerker_id), r.datum, AFD[r.afdeling] ?? '', tsTime(r.in_tijd), tsTime(r.uit_tijd), r.pauze_minuten, fmtUren(tsMinutes(r)), r.status])]));
}

function urenToevoegenModal(datum, herlaad) {
  const mensen = ctx.mw.filter((m) => m.actief);
  openModal(`<h3>Uren toevoegen</h3><p class="sub" style="margin:0">${esc(fmtDay(datum))}</p>
    <label class="f">Medewerker</label><select id="f-mw">${mensen.map((m) => `<option value="${m.id}">${esc(m.naam)}</option>`).join('')}</select>
    <label class="f">Afdeling</label><select id="f-afd">${afdOptions('')}</select>
    <div class="two"><div><label class="f">Start</label><input type="time" id="f-start" value="09:00"></div>
      <div><label class="f">Einde</label><input type="time" id="f-eind" value="17:00"></div></div>
    <label class="f">Pauze (min)</label><input type="number" id="f-pauze" min="0" max="480" value="30">
    <div class="actions"><button class="btn" data-close>Annuleren</button><button class="btn primary" id="save">Toevoegen</button></div>`,
  (m, close) => m.querySelector('#save').addEventListener('click', () => act(async () => {
    const v = (id) => m.querySelector(id).value;
    if (v('#f-eind') <= v('#f-start')) throw new Error('De eindtijd moet na de starttijd liggen');
    check(await sb.from('kloktijden').insert({
      medewerker_id: v('#f-mw'), datum, afdeling: v('#f-afd'), in_tijd: amsToISO(datum, v('#f-start')), uit_tijd: amsToISO(datum, v('#f-eind')),
      pauze_minuten: +v('#f-pauze') || 0, bron: 'handmatig', status: 'goedgekeurd', beoordeeld_door: ctx.me.id, beoordeeld_op: new Date().toISOString(),
    }));
    toast('Uren toegevoegd'); close(); herlaad();
  })));
}

// ====================== medewerker: eigen uren ======================
async function eigenUren(el) {
  const vanaf = addDays(today(), -21);
  const rijen = check(await sb.from('kloktijden').select('*').eq('medewerker_id', ctx.me.id).gte('datum', vanaf).order('in_tijd', { ascending: false }));
  const totaal = rijen.filter((r) => r.status === 'goedgekeurd').reduce((n, r) => n + tsMinutes(r), 0);

  el.innerHTML = `<div class="wrap narrow">
    <div class="crumbs"><a href="#/">Dashboard</a> › Mijn uren</div>
    <div class="row between"><div><h1>Mijn uren</h1><p class="sub">De afgelopen drie weken. Een beheerder beoordeelt je uren.</p></div>
      <button class="btn primary" id="nieuw">Uren indienen</button></div>
    <p class="note">Goedgekeurd in deze periode: <b>${fmtUren(totaal)} uur</b></p>
    ${rijen.length ? rijen.map((r) => {
      const vast = r.status === 'goedgekeurd';
      return `<div class="card" data-id="${r.id}"><div class="row between"><b style="text-transform:capitalize">${esc(fmtDay(r.datum))}</b>${statusPill(r)}</div>
        <div class="row" style="margin-top:8px"><span class="pill">${AFD[r.afdeling] ?? ''}</span>
          <input type="time" data-f="in" value="${tsTime(r.in_tijd)}" ${vast ? 'disabled' : ''}> –
          ${r.uit_tijd ? `<input type="time" data-f="uit" value="${tsTime(r.uit_tijd)}" ${vast ? 'disabled' : ''}>` : '<span class="note">nog ingeklokt</span>'}
          <input type="number" data-f="pauze" min="0" max="480" value="${r.pauze_minuten}" style="width:70px" ${vast || !r.uit_tijd ? 'disabled' : ''}> min pauze
          <span class="grow"></span><b>${r.uit_tijd ? fmtUren(tsMinutes(r)) + ' uur' : ''}</b></div>
        ${r.status === 'afgekeurd' ? `<p class="err-text" style="margin:8px 0 0">Afgekeurd${r.beoordeel_opmerking ? ': ' + esc(r.beoordeel_opmerking) : ''}. Pas je tijden aan om ze opnieuw in te sturen.</p>` : ''}
      </div>`;
    }).join('') : '<div class="card empty">Nog geen uren geregistreerd.</div>'}</div>`;

  el.querySelectorAll('[data-id]').forEach((card) => card.querySelectorAll('input:not([disabled])').forEach((i) => i.addEventListener('change', () => act(async () => {
    const r = rijen.find((x) => x.id === card.dataset.id);
    const uit = card.querySelector('[data-f=uit]')?.value || null;
    check(await sb.rpc('eigen_uren_aanpassen', { p_id: r.id, p_in: card.querySelector('[data-f=in]').value, p_uit: uit, p_pauze: +card.querySelector('[data-f=pauze]').value || 0 }));
    toast('Uren aangepast'); eigenUren(el);
    return true;
  }).then((ok) => { if (!ok) eigenUren(el); }))));

  el.querySelector('#nieuw').addEventListener('click', () => {
    openModal(`<h3>Uren indienen</h3><p class="sub" style="margin:0">Vergeten in te klokken? Vul hier je uren in (maximaal 14 dagen terug).</p>
      <label class="f">Datum</label><input type="date" id="f-datum" value="${today()}" min="${addDays(today(), -14)}" max="${today()}">
      <label class="f">Afdeling</label><select id="f-afd">${afdOptions('')}</select>
      <div class="two"><div><label class="f">Start</label><input type="time" id="f-start" value="09:00"></div>
        <div><label class="f">Einde</label><input type="time" id="f-eind" value="17:00"></div></div>
      <label class="f">Pauze (min)</label><input type="number" id="f-pauze" min="0" max="480" value="30">
      <div class="actions"><button class="btn" data-close>Annuleren</button><button class="btn primary" id="save">Indienen</button></div>`,
    (m, close) => m.querySelector('#save').addEventListener('click', () => act(async () => {
      const v = (id) => m.querySelector(id).value;
      check(await sb.rpc('uren_indienen', { p_datum: v('#f-datum'), p_afdeling: v('#f-afd'), p_start: v('#f-start'), p_eind: v('#f-eind'), p_pauze: +v('#f-pauze') || 0, p_dienst_id: null }));
      toast('Uren ingediend'); close(); eigenUren(el);
    })));
  });
}
