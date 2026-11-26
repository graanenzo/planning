import { sb, ctx, isAdmin, esc, act, check, toast, today, fmtDay, hhmm, tsTime, AFD, AFD_LANG, naamVan, initialen, afdOptions, mijnAfdelingen } from './lib.js';
import { LOGIN_EMAIL } from './config.js';
import { openShiftsView } from './views/open.js';
import { roosterView } from './views/rooster.js';
import { beschikbaarheidView } from './views/beschikbaarheid.js';
import { urenView } from './views/uren.js';

const app = document.getElementById('app');

const ROUTES = {
  '': { titel: 'Home', view: homeView },
  open: { titel: 'Open shifts', view: openShiftsView },
  rooster: { titel: 'Rooster', view: roosterView },
  beschikbaarheid: { titel: 'Beschikbaarheid', view: beschikbaarheidView },
  uren: { titel: 'Uren', view: urenView },
};
const routeKey = () => location.hash.replace(/^#\/?/, '').split('?')[0];

// ---------- inloggen ----------
function loginView(melding = '') {
  app.innerHTML = `
    <form class="card login" id="login">
      <h1 style="font-size:22px">Graan &amp; Zo planning</h1>
      <p class="sub">Log in met je gebruikersnaam.</p>
      <label class="f" for="u">Gebruikersnaam of e-mailadres</label>
      <input id="u" autocomplete="username" autocapitalize="none" required>
      <label class="f" for="p">Wachtwoord</label>
      <input id="p" type="password" autocomplete="current-password" required>
      <button class="btn primary" style="width:100%;margin-top:16px">Inloggen</button>
      <div class="err-text" id="err">${esc(melding)}</div>
    </form>`;
  document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const naam = document.getElementById('u').value.trim();
    const email = naam.includes('@') ? naam : LOGIN_EMAIL(naam.toLowerCase());
    const { error } = await sb.auth.signInWithPassword({ email, password: document.getElementById('p').value });
    if (error) document.getElementById('err').textContent = 'Inloggen mislukt. Controleer je gebruikersnaam en wachtwoord.';
    else start();
  });
}

async function laadProfiel() {
  const { data } = await sb.auth.getSession();
  ctx.session = data.session;
  if (!ctx.session) return false;
  const mw = check(await sb.from('medewerkers').select('id,user_id,naam,gebruikersnaam,rol,afdelingen,actief').order('naam'));
  ctx.mw = mw;
  ctx.me = mw.find((m) => m.user_id === ctx.session.user.id && m.actief) ?? null;
  return true;
}

async function start() {
  try {
    if (!(await laadProfiel())) return loginView();
    if (!ctx.me) {
      await sb.auth.signOut();
      return loginView('Dit account heeft geen actief medewerkersprofiel.');
    }
    render();
  } catch (e) { console.error(e); loginView('Er ging iets mis: ' + e.message); }
}

// ---------- layout ----------
async function render() {
  const key = routeKey();
  const route = ROUTES[key] ?? ROUTES[''];
  const nav = Object.entries(ROUTES).map(([k, r]) => {
    const titel = k === 'rooster' && isAdmin() ? 'Rooster maken' : k === 'uren' && isAdmin() ? 'Urenregistratie' : r.titel;
    return `<a href="#/${k}" class="${k === (ROUTES[key] ? key : '') ? 'on' : ''}">${titel}</a>`;
  }).join('');
  app.innerHTML = `
    <header class="topbar hide-print"><div class="in">
      <span class="brand">Graan &amp; Zo</span>
      <nav>${nav}</nav>
      <span class="who">${esc(ctx.me.naam)}${isAdmin() ? ' · beheerder' : ''}</span>
      <button class="btn sm" id="uit">Uitloggen</button>
    </div></header>
    <main id="view"></main>`;
  document.getElementById('uit').addEventListener('click', async () => { await sb.auth.signOut(); ctx.me = null; loginView(); });
  const view = document.getElementById('view');
  view.innerHTML = '<div class="wrap"><p class="sub">Laden…</p></div>';
  await act(() => route.view(view));
}

// ---------- home ----------
async function homeView(el) {
  const vandaag = today();
  const [open, diensten, aanwezig, aanm, uren] = await Promise.all([
    sb.from('kloktijden').select('*').eq('medewerker_id', ctx.me.id).is('uit_tijd', null).eq('datum', vandaag).maybeSingle(),
    sb.from('diensten').select('*').gte('datum', vandaag).order('datum').order('start_tijd'),
    sb.rpc('aanwezig_vandaag'),
    isAdmin() ? sb.from('shift_aanmeldingen').select('id', { count: 'exact', head: true }).eq('status', 'aangemeld') : { count: 0 },
    isAdmin() ? sb.from('kloktijden').select('id', { count: 'exact', head: true }).eq('status', 'te_beoordelen').not('uit_tijd', 'is', null) : { count: 0 },
  ]);
  const klok = check(open); const alle = check(diensten); const aw = check(aanwezig) ?? [];
  const mijn = alle.filter((d) => d.medewerker_id === ctx.me.id).slice(0, 8);
  const vandaagDiensten = alle.filter((d) => d.datum === vandaag);
  const ingeklokt = new Set(aw.filter((a) => a.ingeklokt).map((a) => a.medewerker_id));
  const eigenVandaag = mijn.find((d) => d.datum === vandaag);

  const klokKaart = klok
    ? `<div class="clock"><div><div class="sub" style="margin:0">Je bent ingeklokt${klok.afdeling ? ' · ' + AFD[klok.afdeling] : ''}</div>
         <div class="big">Sinds ${tsTime(klok.in_tijd)}</div></div>
         <div class="row"><label class="note" for="pauze">Pauze (min)</label><input id="pauze" type="number" min="0" max="480" value="0" style="width:80px">
         <button class="btn primary" id="uitklokken">Uitklokken</button></div></div>`
    : `<div class="clock"><div><div class="sub" style="margin:0">Je bent niet ingeklokt</div>
         <div class="big">${eigenVandaag ? `Vandaag ${hhmm(eigenVandaag.start_tijd)} - ${hhmm(eigenVandaag.eind_tijd)}` : 'Geen dienst vandaag'}</div></div>
         <div class="row"><select id="klokafd">${afdOptions(eigenVandaag?.afdeling)}</select>
         <button class="btn primary" id="inklokken">Inklokken</button></div></div>`;

  const perAfd = Object.keys(AFD).map((a) => {
    const rijen = vandaagDiensten.filter((d) => d.afdeling === a);
    if (!rijen.length) return '';
    return `<div class="card"><strong>${AFD_LANG[a]}</strong>${rijen.map((d) => `
      <div class="arow"><span class="avatar">${initialen(naamVan(d.medewerker_id))}</span>
      <span class="grow">${esc(naamVan(d.medewerker_id))}<br><span class="note">${hhmm(d.start_tijd)} - ${hhmm(d.eind_tijd)}</span></span>
      ${ingeklokt.has(d.medewerker_id) ? '<span class="pill green">Aanwezig</span>' : ''}</div>`).join('')}</div>`;
  }).join('');

  el.innerHTML = `<div class="wrap narrow">
    <h1>Hoi ${esc(ctx.me.naam.split(' ')[0])}</h1><p class="sub">${esc(fmtDay(vandaag))}</p>
    <div class="card">${klokKaart}</div>
    ${isAdmin() ? `<h2>Te beoordelen</h2><div class="tiles">
      <a class="tile" href="#/rooster"><div class="card"><div class="sub" style="margin:0">Aanmeldingen op shifts</div><div class="big" style="font-size:28px;font-weight:700">${aanm.count ?? 0}</div></div></a>
      <a class="tile" href="#/uren"><div class="card"><div class="sub" style="margin:0">Uren om te beoordelen</div><div class="big" style="font-size:28px;font-weight:700">${uren.count ?? 0}</div></div></a>
    </div>` : ''}
    <h2>Mijn komende diensten</h2>
    ${mijn.length ? mijn.map((d) => `<div class="card shift"><div><div class="time">${hhmm(d.start_tijd)} - ${hhmm(d.eind_tijd)}</div>
      <div class="meta"><span>${esc(fmtDay(d.datum))}</span><span class="pill">${AFD[d.afdeling]}</span></div></div></div>`).join('')
      : `<div class="card empty">Je hebt nog geen diensten. <a href="#/open">Bekijk open shifts</a>.</div>`}
    <h2>Vandaag aan het werk</h2>
    ${perAfd || '<div class="card empty">Niemand is vandaag ingepland.</div>'}
  </div>`;

  el.querySelector('#inklokken')?.addEventListener('click', () => act(async () => {
    check(await sb.rpc('inklokken', { p_afdeling: el.querySelector('#klokafd').value || null }));
    toast('Ingeklokt'); homeView(el);
  }));
  el.querySelector('#uitklokken')?.addEventListener('click', () => act(async () => {
    check(await sb.rpc('uitklokken', { p_pauze: +el.querySelector('#pauze').value || 0 }));
    toast('Uitgeklokt'); homeView(el);
  }));
}

window.addEventListener('hashchange', () => ctx.me && render());
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { ctx.me = null; } });
start();
