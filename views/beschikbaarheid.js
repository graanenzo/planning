import { sb, ctx, isAdmin, esc, act, check, toast, today, mondayOf, addDays, weekDays, DAGEN, fmtDay, fmtShort, weekNr, weekNav, bindWeekNav, hhmm, initialen } from '../lib.js';

const state = { monday: mondayOf(today()) };

export async function beschikbaarheidView(el) {
  const dagen = weekDays(state.monday);
  const rijen = check(await sb.from('beschikbaarheid').select('*').gte('datum', dagen[0]).lte('datum', dagen[6]));
  const mijn = new Map(rijen.filter((r) => r.medewerker_id === ctx.me.id).map((r) => [r.datum, r]));

  const dagRij = (d, i) => {
    const r = mijn.get(d); const verleden = d < today();
    return `<div class="card" data-dag="${d}">
      <div class="row between"><strong style="text-transform:capitalize">${esc(fmtDay(d))}</strong>
        <select data-status ${verleden ? 'disabled' : ''}>
          <option value="">Niet ingevuld</option>
          <option value="beschikbaar" ${r?.status === 'beschikbaar' ? 'selected' : ''}>Beschikbaar</option>
          <option value="deels" ${r?.status === 'deels' ? 'selected' : ''}>Deels beschikbaar</option>
          <option value="niet" ${r?.status === 'niet' ? 'selected' : ''}>Niet beschikbaar</option>
        </select></div>
      <div class="row" style="margin-top:8px;${r?.status === 'deels' ? '' : 'display:none'}" data-tijden>
        <label class="note">Van</label><input type="time" data-van value="${hhmm(r?.van)}">
        <label class="note">Tot</label><input type="time" data-tot value="${hhmm(r?.tot)}">
      </div>
      <input data-opm placeholder="Opmerking (optioneel)" value="${esc(r?.opmerking ?? '')}" style="width:100%;margin-top:8px" ${verleden ? 'disabled' : ''}>
    </div>`;
  };

  el.innerHTML = `<div class="wrap narrow">
    <div class="crumbs"><a href="#/">Dashboard</a> › Beschikbaarheid</div>
    <div class="row between"><div><h1>Beschikbaarheid <span class="pill">Week ${weekNr(state.monday)}</span></h1>
      <p class="sub">Geef per dag aan wanneer je kunt werken. Wijzigingen worden direct opgeslagen.</p></div>${weekNav(state.monday)}</div>
    <div class="row hide-print" style="margin-bottom:12px">
      <button class="btn sm" data-bulk="beschikbaar">Hele week beschikbaar</button>
      <button class="btn sm" data-bulk="niet">Hele week niet beschikbaar</button>
      <button class="btn sm" data-bulk="">Wissen</button></div>
    ${dagen.map(dagRij).join('')}
    ${isAdmin() ? '<div id="team"></div>' : ''}
  </div>`;

  bindWeekNav(el, state, () => beschikbaarheidView(el));

  const opslaan = (card) => act(async () => {
    const datum = card.dataset.dag;
    const status = card.querySelector('[data-status]').value;
    card.querySelector('[data-tijden]').style.display = status === 'deels' ? '' : 'none';
    if (!status) {
      check(await sb.from('beschikbaarheid').delete().eq('medewerker_id', ctx.me.id).eq('datum', datum));
      return;
    }
    const van = card.querySelector('[data-van]').value, tot = card.querySelector('[data-tot]').value;
    if (status === 'deels' && (!van || !tot)) return; // wacht tot beide tijden zijn ingevuld
    if (status === 'deels' && tot <= van) throw new Error('De eindtijd moet na de starttijd liggen');
    check(await sb.from('beschikbaarheid').upsert({
      medewerker_id: ctx.me.id, datum, status,
      van: status === 'deels' ? van : null, tot: status === 'deels' ? tot : null,
      opmerking: card.querySelector('[data-opm]').value.trim() || null, bijgewerkt_op: new Date().toISOString(),
    }, { onConflict: 'medewerker_id,datum' }));
    toast('Opgeslagen');
  });
  el.querySelectorAll('[data-dag]').forEach((card) => card.querySelectorAll('select,input').forEach((i) => i.addEventListener('change', () => opslaan(card))));

  el.querySelectorAll('[data-bulk]').forEach((b) => b.addEventListener('click', () => act(async () => {
    const komend = dagen.filter((d) => d >= today());
    if (!b.dataset.bulk) check(await sb.from('beschikbaarheid').delete().eq('medewerker_id', ctx.me.id).in('datum', komend));
    else check(await sb.from('beschikbaarheid').upsert(komend.map((datum) => ({ medewerker_id: ctx.me.id, datum, status: b.dataset.bulk })), { onConflict: 'medewerker_id,datum' }));
    beschikbaarheidView(el);
  })));

  if (isAdmin()) teamOverzicht(el.querySelector('#team'), dagen, rijen);
}

function teamOverzicht(box, dagen, rijen) {
  const mensen = ctx.mw.filter((m) => m.actief);
  const cel = (m, d) => {
    const r = rijen.find((x) => x.medewerker_id === m.id && x.datum === d);
    if (!r) return '';
    const tekst = r.status === 'niet' ? '✕' : r.status === 'deels' ? `${hhmm(r.van)} – ${hhmm(r.tot)}` : 'Beschikbaar';
    return `<div class="avail ${r.status}" title="${esc(r.opmerking ?? '')}">${tekst}</div>`;
  };
  box.innerHTML = `<h2>Overzicht team</h2><div class="gridwrap"><table class="grid">
    <thead><tr><th class="name"></th>${dagen.map((d, i) => `<th class="${d === today() ? 'today' : ''}">${DAGEN[i]} ${+d.slice(8)}</th>`).join('')}</tr></thead>
    <tbody>${mensen.map((m) => {
      const n = rijen.filter((r) => r.medewerker_id === m.id && r.status !== 'niet').length;
      return `<tr><td class="name"><div class="person"><span class="avatar">${initialen(m.naam)}</span><div>${esc(m.naam)}<small>${n}/7 dagen</small></div></div></td>
      ${dagen.map((d) => `<td class="${d === today() ? 'today' : ''}">${cel(m, d)}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>`;
}
