// The Billionaire Polo Club — member app.
import {
  esc, istDate, addDays, dayRange, fmtTime, fmtDow, fmtDayNum, fmtLongDay, fmtShortDay, fmtDateOnly,
  inr, kindLabel, KINDS, KIND_SECTIONS, gstTotal, greeting, firstName, waLink, upiLink, errMsg, icon, phoneDigits,
} from './util.js';
import { staffModule } from './staff.js';

const cfg = window.CLUB_CONFIG || {};
const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

const S = {
  api: null, user: null, me: null, settings: {}, view: 'app', authView: 'signin', authMsg: '',
  tab: 'home', riders: [], balances: [], bookings: [], waitlist: [], packages: [], closures: [], slots: [],
  book: { day: istDate(), kind: 'all', rider: null },
  sheet: null, loadingUser: null,
};
const TABS = ['home', 'book', 'packages', 'rides', 'profile', 'staff'];
const isStaff = () => ['staff', 'admin'].includes(S.me?.role);
const today = () => istDate();
const club = () => S.settings?.club_name || 'The Billionaire Polo Club';

function toast(msg, err = false) {
  $toast.textContent = msg;
  $toast.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $toast.className = ''; }, 3600);
}
function openSheet(sheet) { S.sheet = sheet; renderSheet(); }
function closeSheet() { S.sheet = null; renderSheet(); }

const Staff = staffModule({ S, get api() { return S.api; }, render: () => render(), toast, openSheet, closeSheet, refreshMember: () => refreshAll() });

// ---------------------------------------------------------------- data
async function loadMember() {
  const t = today();
  const [me, riders, balances, bookings, waitlist, packages, closures, settings] = await Promise.all([
    S.api.me(), S.api.myRiders(), S.api.myBalances(), S.api.myBookings(), S.api.myWaitlist(),
    S.api.packages(), S.api.closures(t, addDays(t, 30)), S.api.settings(),
  ]);
  Object.assign(S, { me, riders: riders.filter((r) => r.active), balances, bookings, waitlist, packages, closures, settings });
  if (!S.riders.some((r) => r.id === S.book.rider)) { S.book.rider = S.riders[0]?.id || null; if (S.book.rider) S.book.kind = riderKind(S.book.rider); }
}
async function loadSlots() {
  const r = dayRange(today(), 15);
  S.slots = await S.api.slots(r.from, r.to);
}
async function refreshAll() {
  await Promise.all([loadMember(), loadSlots()]);
  if (S.tab === 'staff' && isStaff()) await Staff.load();
  else if (isStaff()) Staff.loadBadge().then(render).catch(() => {});
  render();
}

const activeMemberships = () => S.balances.filter((m) => m.status === 'active' && m.expires_on >= today());
const ridesLeft = (kind) => activeMemberships().filter((m) => !kind || m.kind === kind).reduce((n, m) => n + Math.max(0, m.rides_left), 0);
const riderKind = (id) => (S.riders.find((r) => r.id === id)?.discipline || 'Polo').toLowerCase();
const gstPct = () => Number(S.settings?.gst_percent ?? 18);
const pendingMemberships = () => S.balances.filter((m) => m.status === 'pending');
const liveBooking = (b) => b.status !== 'cancelled';
const upcoming = () => S.bookings
  .filter((b) => b.status === 'booked' && b.sessions && new Date(b.sessions.starts_at).getTime() > Date.now() - 3600e3)
  .sort((a, b) => a.sessions.starts_at.localeCompare(b.sessions.starts_at));
const pastRides = () => S.bookings
  .filter((b) => b.sessions && !(b.status === 'booked' && new Date(b.sessions.starts_at).getTime() > Date.now() - 3600e3))
  .sort((a, b) => b.sessions.starts_at.localeCompare(a.sessions.starts_at)).slice(0, 40);
const riderName = (id) => S.riders.find((r) => r.id === id)?.name || 'rider';
const reportBy = (ts) => fmtTime(new Date(new Date(ts).getTime() - 20 * 60e3));

// ---------------------------------------------------------------- render
function render() {
  if (!S.api) return;
  if (!S.user) { $app.innerHTML = authView(); renderSheet(); return; }
  if (S.view === 'reset') { $app.innerHTML = resetView(); return; }
  if (!S.me) { $app.innerHTML = `<div class="boot"><img src="img/logo.jpg" alt=""><p>Loading your account…</p></div>`; return; }
  if (S.tab === 'staff' && !isStaff()) S.tab = 'home';
  const views = { home: homeView, book: bookView, packages: packagesView, rides: ridesView, profile: profileView, staff: () => Staff.render() };
  $app.innerHTML = header() + `<main id="main" class="${S.tab === 'staff' ? 'wide' : ''}">${views[S.tab]()}</main>` + tabsBar();
  renderSheet();
}

function header() {
  const demo = S.api.mode === 'demo'
    ? `<div class="demo-bar">Demo mode · example data, nothing is saved. <button type="button" data-act="signout">Switch user</button></div>` : '';
  return `${demo}<header class="top"><div class="top-in">
    <div class="crest"><img src="img/logo.jpg" alt="${esc(club())} crest"></div>
    <div class="name"><b>${esc(club())}</b><span>${esc(S.settings?.tagline || 'Equestrian Academy')}</span></div>
  </div></header>`;
}

function tabsBar() {
  const items = [['home', 'Home'], ['book', 'Book'], ['packages', 'Packages'], ['rides', 'My rides'], ['profile', 'Profile']];
  if (isStaff()) items.push(['staff', 'Staff']);
  const badge = Staff.badge();
  return `<nav class="tabs" aria-label="Main"><div class="tabs-in">${items.map(([k, label]) => `
    <button class="tab" type="button" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>
      ${icon(k)}${label}${k === 'staff' && badge ? `<span class="badge">${badge}</span>` : ''}
    </button>`).join('')}</div></nav>`;
}

// ---------------- auth
function authView() {
  const demo = S.api.mode === 'demo';
  const v = S.authView;
  let body = '';
  if (v === 'signin') body = `
    <form data-form="signin" novalidate>
      <h2>Sign in</h2>
      ${S.authMsg ? `<div class="form-ok">${esc(S.authMsg)}</div>` : ''}
      <div class="field"><label for="si-email">Email</label><input id="si-email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="si-pass">Password</label><input id="si-pass" name="password" type="password" autocomplete="current-password" required></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-gold btn-block" type="submit">Sign in</button>
      <div class="split"><button type="button" class="link-btn" data-act="auth-view" data-view="signup">Create an account</button>
      <button type="button" class="link-btn" data-act="auth-view" data-view="forgot">Forgot password?</button></div>
    </form>`;
  if (v === 'signup') body = `
    <form data-form="signup" novalidate>
      <h2>Create your account</h2>
      <p class="muted small">One account per family. You can add each rider after signing up.</p>
      <div class="field"><label for="su-name">Your full name</label><input id="su-name" name="full_name" type="text" autocomplete="name" required></div>
      <div class="field"><label for="su-phone">Mobile number (WhatsApp)</label><input id="su-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="98765 43210" required></div>
      <div class="field"><label for="su-email">Email</label><input id="su-email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="su-pass">Password</label><input id="su-pass" name="password" type="password" autocomplete="new-password" minlength="6" required><span class="hint">At least 6 characters.</span></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-gold btn-block" type="submit">Create account</button>
      <button type="button" class="link-btn" data-act="auth-view" data-view="signin">I already have an account</button>
    </form>`;
  if (v === 'forgot') body = `
    <form data-form="forgot" novalidate>
      <h2>Reset your password</h2>
      ${S.authMsg ? `<div class="form-ok">${esc(S.authMsg)}</div>` : '<p class="muted small">We’ll email you a link to set a new password.</p>'}
      <div class="field"><label for="fp-email">Email</label><input id="fp-email" name="email" type="email" autocomplete="email" required></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-gold btn-block" type="submit">Send reset link</button>
      <button type="button" class="link-btn" data-act="auth-view" data-view="signin">Back to sign in</button>
    </form>`;
  const demoBox = demo ? `<div class="card note stack">
      <div><div class="section-label">Demo mode</div><p class="small">This copy isn’t connected to a database yet, so it uses example data and saves nothing.</p></div>
      ${S.api.demoUsers.map((u) => `<button class="btn btn-navy btn-block" type="button" data-act="demo-login" data-id="${u.id}">${esc(u.label)}</button>`).join('')}
    </div>` : '';
  return `<div class="auth">
    <div class="auth-top"><div class="crest"><img src="img/logo.jpg" alt="${esc(club())} crest"></div>
      <h1>${esc(club())}</h1><div class="eyebrow">${esc(S.settings?.tagline || 'Equestrian Academy')}</div></div>
    <div class="auth-body">${demoBox}${demo && v === 'signin' ? '' : body}</div>
  </div>`;
}

function resetView() {
  return `<div class="auth"><div class="auth-top"><div class="crest"><img src="img/logo.jpg" alt=""></div><h1>${esc(club())}</h1></div>
    <div class="auth-body"><form data-form="newpass" novalidate>
      <h2>Set a new password</h2>
      <div class="field"><label for="np">New password</label><input id="np" name="password" type="password" autocomplete="new-password" minlength="6" required></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-gold btn-block" type="submit">Save password</button>
    </form></div></div>`;
}

// ---------------- home
function homeView() {
  const act = activeMemberships().sort((a, b) => a.expires_on.localeCompare(b.expires_on));
  const pend = pendingMemberships();
  const next = upcoming()[0];
  const st = S.settings || {};
  const closures = S.closures.filter((c) => c.day >= today()).slice(0, 3);

  const pkgCard = act.length ? `
    <section class="card dark" aria-label="Your packages">
      <div class="split"><div class="section-label" style="color:var(--gold)">Rides left</div>
      <div class="small" style="color:#C8CCD6">${act.length} active package${act.length > 1 ? 's' : ''}</div></div>
      ${act.map((m) => `<div class="stack tight">
        <div class="row" style="align-items:baseline;gap:10px"><div class="big-num num" style="font-size:${act.length > 1 ? 40 : 54}px">${Math.max(0, m.rides_left)}</div>
          <div style="color:#E3E6EC"><b>${esc(kindLabel(m.kind))}</b> · of ${m.rides_total}<div class="tiny" style="color:#C8CCD6">${esc(m.package_name)} · till ${esc(fmtDateOnly(m.expires_on))}</div></div></div>
        <div class="bar"><span style="width:${Math.round((Math.max(0, m.rides_left) / m.rides_total) * 100)}%"></span></div></div>`).join('')}
      <div class="grid2"><button class="btn btn-gold" type="button" data-act="tab" data-tab="book">Book a ride</button>
      <button class="btn btn-ghost on-dark" type="button" data-act="tab" data-tab="packages">Top up</button></div>
    </section>` : `
    <section class="card dark">
      <div class="section-label" style="color:var(--gold)">No active package</div>
      <p style="color:#E3E6EC">${pend.length ? 'Your payment is with the club for confirmation. Your rides appear here as soon as it’s confirmed.' : 'Buy a package to start booking rides.'}</p>
      <button class="btn btn-gold" type="button" data-act="tab" data-tab="packages">${pend.length ? 'View payment status' : 'See packages'}</button>
    </section>`;

  const pendNote = act.length && pend.length ? `<div class="card note"><p class="small"><b>${pend.length} payment${pend.length > 1 ? 's' : ''} waiting for confirmation.</b> The new rides are added once the club confirms.</p></div>` : '';

  const nextCard = next ? `
    <section class="card" aria-label="Your next ride">
      <div class="section-label">Your next ride</div>
      <div class="row">
        <div class="datebox"><small>${esc(fmtDow(next.sessions.starts_at))}</small><b>${esc(fmtDayNum(next.sessions.starts_at))}</b></div>
        <div class="grow"><div class="strong" style="font-size:17px">${esc(fmtTime(next.sessions.starts_at))} · ${esc(kindLabel(next.sessions.kind))}</div>
        <div class="muted small">${esc(next.riders?.name || '')}${next.sessions.coach ? ' · ' + esc(next.sessions.coach) : ''}</div></div>
      </div>
      <div class="grid2">
        <div class="kv"><span>Horse</span><b>${esc(next.horses?.name || 'Assigned at the yard')}</b></div>
        <div class="kv"><span>Report by</span><b>${esc(reportBy(next.sessions.starts_at))}</b></div>
      </div>
    </section>` : (act.length ? `<div class="empty"><b>No rides booked</b><p class="muted small">Pick a slot for the coming days.</p><button class="btn btn-gold" type="button" data-act="tab" data-tab="book">Book a ride</button></div>` : '');

  const quick = [
    st.phone ? `<a class="quick" href="tel:+${esc(phoneDigits(st.phone))}">${icon('phone')}Call the club</a>` : '',
    st.whatsapp ? `<a class="quick" href="${esc(waLink(st.whatsapp, 'Hello, '))}" target="_blank" rel="noopener">${icon('chat')}WhatsApp</a>` : '',
    st.maps_url ? `<a class="quick" href="${esc(st.maps_url)}" target="_blank" rel="noopener">${icon('pin')}Directions</a>` : '',
  ].filter(Boolean);

  const notices = [
    st.notice ? `<div class="card note row top-align">${icon('info', 20)}<p class="small">${esc(st.notice)}</p></div>` : '',
    ...closures.map((c) => `<div class="card note row top-align">${icon('info', 20)}<div><div class="strong">Club closed ${esc(fmtDateOnly(c.day))}</div><p class="small">${esc(c.reason)}</p></div></div>`),
  ].join('');

  return `<div class="stack tight"><div class="muted small strong">${esc(fmtLongDay(new Date()))} · Open 6–9 am and 4–6 pm</div>
    <h1>${greeting()}, ${esc(firstName(S.me.full_name))}</h1></div>
    ${pkgCard}${pendNote}${nextCard}
    ${quick.length ? `<div class="grid${quick.length === 3 ? '3' : '2'}">${quick.join('')}</div>` : ''}
    ${notices}
    ${S.riders.length ? '' : `<div class="card"><b>Add who’s riding</b><p class="small muted">Add yourself and any family members so you can book for them.</p><button class="btn btn-navy" type="button" data-act="rider-new">Add a rider</button></div>`}`;
}

// ---------------- book
function bookView() {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  const myDays = new Set(upcoming().map((b) => istDate(b.sessions.starts_at)));
  const closedMap = Object.fromEntries(S.closures.map((c) => [c.day, c.reason]));
  const day = S.book.day;
  const daySlots = S.slots.filter((s) => istDate(s.starts_at) === day && (S.book.kind === 'all' || s.kind === S.book.kind));
  const kindsPresent = new Set(S.slots.map((s) => s.kind));

  const riderChips = S.riders.length
    ? `<div class="row" style="flex-wrap:wrap"><span class="small strong muted">Rider</span><div class="chips">${S.riders.map((r) => `<button type="button" class="chip" data-act="pick-rider" data-id="${r.id}" aria-pressed="${r.id === S.book.rider}">${esc(r.name)}</button>`).join('')}
       <button type="button" class="chip" data-act="rider-new" aria-label="Add a rider">+</button></div></div>`
    : `<div class="card note"><b>Add a rider first</b><p class="small">Tell us who is riding so the yard can match a horse.</p><button class="btn btn-navy" type="button" data-act="rider-new">Add a rider</button></div>`;

  const dayStrip = `<div class="days" role="group" aria-label="Choose a day">${days.map((d) => {
    const ts = d + 'T12:00:00+05:30';
    return `<button type="button" class="day ${myDays.has(d) ? 'has' : ''} ${closedMap[d] ? 'closed' : ''}" data-act="pick-day" data-day="${d}" aria-pressed="${d === day}" aria-label="${esc(fmtLongDay(ts))}">
      <small>${esc(i18nDow(ts, d))}</small><b>${esc(fmtDayNum(ts))}</b><i></i></button>`;
  }).join('')}</div>`;

  const kindChips = `<div class="chips">${[...Object.entries(KINDS).filter(([k]) => kindsPresent.has(k)), ['all', 'All']].map(([k, l]) =>
    `<button type="button" class="chip" data-act="pick-kind" data-kind="${k}" aria-pressed="${S.book.kind === k}">${esc(l)}</button>`).join('')}</div>`;

  let list;
  if (closedMap[day]) list = `<div class="empty"><h3>Club closed</h3><p class="muted">${esc(closedMap[day])}</p></div>`;
  else if (!daySlots.length) list = `<div class="empty"><h3>No sessions</h3><p class="muted small">Nothing is scheduled ${S.book.kind === 'all' ? 'this day' : 'of this type this day'}. Try another day.</p></div>`;
  else {
    const morning = daySlots.filter((s) => Number(fmtHour(s.starts_at)) < 12);
    const evening = daySlots.filter((s) => Number(fmtHour(s.starts_at)) >= 12);
    list = (morning.length ? `<div class="section-label">Morning · 6–9 am</div>${morning.map(slotCard).join('')}` : '')
      + (evening.length ? `<div class="section-label" style="margin-top:6px">Evening · 4–6 pm</div>${evening.map(slotCard).join('')}` : '');
  }

  return `<h1>Book a ride</h1>${riderChips}${dayStrip}${kindChips}
    <div class="muted small strong">${esc(fmtLongDay(day + 'T12:00:00+05:30'))}</div>
    <div class="stack">${list}</div>
    <p class="tiny muted" style="text-align:center">Free cancellation up to ${S.settings?.cancel_hours ?? 12} hours before. The ride goes back to your package.</p>`;
}
const fmtHour = (ts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date(ts));
function i18nDow(ts, d) { return d === today() ? 'Today' : fmtDow(ts); }

function slotCard(s) {
  const rider = S.book.rider;
  const past = new Date(s.starts_at) <= new Date();
  const mine = S.bookings.find((b) => b.session_id === s.id && b.rider_id === rider && liveBooking(b));
  const others = S.bookings.filter((b) => b.session_id === s.id && b.rider_id !== rider && liveBooking(b)).map((b) => b.riders?.name).filter(Boolean);
  const left = Math.max(0, s.capacity - s.booked);
  const full = left === 0;
  const onWait = S.waitlist.some((w) => w.session_id === s.id && w.rider_id === rider);
  const pct = Math.min(100, Math.round((s.booked / s.capacity) * 100));
  let pill;
  if (s.cancelled) pill = '<span class="pill bad">Cancelled</span>';
  else if (mine) pill = '<span class="pill ok">You’re in</span>';
  else if (past) pill = '<span class="pill info">Started</span>';
  else if (full) pill = '<span class="pill bad">Full</span>';
  else pill = `<span class="pill ${left <= 2 ? 'warn' : 'info'} num">${left} of ${s.capacity} left</span>`;

  let action = '';
  if (s.cancelled || (past && !mine)) action = '';
  else if (mine) action = `<div class="row"><div class="grow pill ok" style="min-height:44px;justify-content:center;font-size:14px;border-radius:12px">${icon('check', 16)} Booked · ${esc(riderName(rider))}</div>
      ${past ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="ask-cancel" data-id="${mine.id}">Cancel</button>`}</div>`;
  else if (!rider) action = `<button class="btn btn-gold" type="button" data-act="rider-new">Add a rider to book</button>`;
  else if (full) action = `<button class="btn btn-ghost" type="button" data-act="${onWait ? 'waitlist-leave' : 'waitlist-join'}" data-id="${s.id}">${onWait ? 'On the waitlist · tap to leave' : 'Join the waitlist'}</button>`;
  else action = `<button class="btn btn-gold" type="button" data-act="ask-book" data-id="${s.id}">Book for ${esc(riderName(rider))}</button>`;

  return `<article class="card" style="${mine ? 'border-color:#9CC3A9' : ''}">
    <div class="split" style="align-items:flex-start;flex-wrap:nowrap">
      <div class="grow"><h3 class="num" style="font-size:22px">${esc(fmtTime(s.starts_at))}</h3>
      <div class="small muted">${esc(kindLabel(s.kind))} · ${s.duration_min} min${s.level && s.level !== 'All levels' ? ' · ' + esc(s.level) : ''}${s.coach ? ' · ' + esc(s.coach) : ''}</div></div>${pill}
    </div>
    <div class="bar ${full ? 'full' : ''}"><span style="width:${pct}%"></span></div>
    ${s.note ? `<p class="small">${esc(s.note)}</p>` : ''}
    ${others.length ? `<p class="tiny muted">Also booked from your family: ${esc(others.join(', '))}</p>` : ''}
    ${action}
  </article>`;
}

// ---------------- packages
function packagesView() {
  const act = activeMemberships();
  const pend = pendingMemberships();
  const old = S.balances.filter((m) => !(m.status === 'active' && m.expires_on >= today()) && m.status !== 'pending').slice(0, 6);
  const mine = act.length || pend.length ? `<section class="stack">
      <div class="section-label">Your packages</div>
      ${act.map((m) => `<div class="card"><div class="split"><b>${esc(m.package_name)}</b><span class="pill ok">${esc(kindLabel(m.kind))} · Active</span></div>
        <div class="row"><div class="grow"><div class="bar"><span style="width:${Math.round((m.rides_left / m.rides_total) * 100)}%"></span></div></div><b class="num">${m.rides_left}/${m.rides_total}</b></div>
        <p class="small muted">Valid ${esc(fmtDateOnly(m.starts_on))} – ${esc(fmtDateOnly(m.expires_on))}</p></div>`).join('')}
      ${pend.map((m) => `<div class="card"><div class="split"><b>${esc(m.package_name)}</b><span class="pill warn">Waiting for club</span></div>
        <p class="small muted">${esc(kindLabel(m.kind))} · ${inr(m.price_inr)} + GST · ${esc(methodLabel(m.payment_method))}${m.payment_ref ? ' · Ref ' + esc(m.payment_ref) : ''}. Rides are added once the club confirms your payment.</p></div>`).join('')}
    </section>` : '';
  const forSale = S.packages.filter((p) => p.active);
  const pct = gstPct();
  const groups = Object.keys(KINDS).map((k) => [k, forSale.filter((p) => p.kind === k)]).filter(([, l]) => l.length);
  const shop = groups.length ? groups.map(([k, list]) => `<section class="stack"><div class="section-label">${esc(KIND_SECTIONS[k] || kindLabel(k))}</div>
    <div class="card flat">${list.map((p) => `<div class="list-row" style="align-items:center">
      <div class="grow"><b>${esc(p.name)}</b><div class="small muted">${p.rides} ride${p.rides > 1 ? 's' : ''}${p.description && !/rides?$/.test(p.description) ? ' · ' + esc(p.description.replace(/ · \d+ rides$/, '')) : ''} · ${p.validity_days >= 360 ? '1 year' : p.validity_days + ' days'}</div></div>
      <div style="text-align:right"><b class="num">${inr(p.price_inr)}</b><div class="tiny muted">+ GST</div></div>
      <button class="btn btn-gold btn-sm" type="button" data-act="buy" data-id="${p.id}">Buy</button></div>`).join('')}</div></section>`).join('')
    + `<p class="tiny muted">All prices exclude GST${pct ? ` (${pct}%, added at payment)` : ''}.</p>`
    : '<div class="empty"><p class="muted">The club hasn’t listed packages yet.</p></div>';
  const extras = S.settings?.extras ? `<section class="card note"><div class="section-label">Also at the club</div><p class="small" style="white-space:pre-line">${esc(S.settings.extras)}</p>
    ${S.settings.whatsapp ? `<a class="btn btn-navy btn-sm" style="align-self:flex-start" href="${esc(waLink(S.settings.whatsapp, 'Hello, I would like to know more about stable boarding / tournaments.'))}" target="_blank" rel="noopener">${icon('chat', 16)} Enquire on WhatsApp</a>` : ''}</section>` : '';
  const history = old.length ? `<details class="card"><summary class="strong">Past packages</summary>
    ${old.map((m) => `<div class="split small" style="padding:6px 0;border-top:1px solid var(--line-2)"><span>${esc(m.package_name)}</span><span class="muted">${m.status === 'active' ? 'Expired ' + esc(fmtDateOnly(m.expires_on)) : esc(m.status)}</span></div>`).join('')}</details>` : '';
  return `<h1>Packages</h1>
    <p class="muted">${Object.keys(KINDS).filter((k) => ridesLeft(k)).map((k) => `<b class="num">${ridesLeft(k)}</b> ${esc(kindLabel(k).toLowerCase())}`).join(', ') || '<b>No</b>'} rides left. Polo rides book polo sessions, riding rides book riding, jumping rides book jumping.</p>
    ${mine}${shop}${extras}${history}`;
}
const methodLabel = (m) => ({ upi: 'UPI', cash: 'Cash at the club', bank: 'Bank transfer', card: 'Card', other: 'Other' }[m] || m);

// ---------------- my rides
function ridesView() {
  const up = upcoming();
  const past = pastRides();
  const statusPill = (b) => ({ attended: '<span class="pill ok">Completed</span>', no_show: '<span class="pill bad">No-show</span>', cancelled: '<span class="pill info">Cancelled</span>', booked: '<span class="pill info">Not marked</span>' }[b.status]);
  return `<h1>My rides</h1>
    <div class="section-label">Upcoming</div>
    ${up.length ? up.map((b) => `<div class="card"><div class="row">
        <div class="datebox"><small>${esc(fmtDow(b.sessions.starts_at))}</small><b>${esc(fmtDayNum(b.sessions.starts_at))}</b></div>
        <div class="grow"><div class="strong">${esc(fmtTime(b.sessions.starts_at))} · ${esc(kindLabel(b.sessions.kind))}</div>
        <div class="small muted">${esc(b.riders?.name || '')}${b.horses?.name ? ' on ' + esc(b.horses.name) : ''}${b.sessions.coach ? ' · ' + esc(b.sessions.coach) : ''}</div></div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="ask-cancel" data-id="${b.id}">Cancel</button></div></div>`).join('')
      : `<div class="empty"><p class="muted">Nothing booked.</p><button class="btn btn-gold" type="button" data-act="tab" data-tab="book">Book a ride</button></div>`}
    <div class="section-label" style="margin-top:8px">History</div>
    ${past.length ? past.map((b) => `<div class="card"><div class="split"><b>${esc(fmtShortDay(b.sessions.starts_at))} · ${esc(fmtTime(b.sessions.starts_at))}</b>${statusPill(b)}</div>
        <div class="small muted">${esc(kindLabel(b.sessions.kind))} · ${esc(b.riders?.name || '')}${b.horses?.name ? ' · ' + esc(b.horses.name) : ''}${b.sessions.coach ? ' · ' + esc(b.sessions.coach) : ''}</div>
        ${b.coach_note ? `<div class="quoted">“${esc(b.coach_note)}”</div>` : ''}</div>`).join('')
      : '<p class="muted small">Your completed rides and coach notes will appear here.</p>'}`;
}

// ---------------- profile
function profileView() {
  const st = S.settings || {};
  return `<h1>Profile</h1>
    <section class="stack"><div class="section-label">Riders on this account</div>
      ${S.riders.map((r) => `<div class="card"><div class="row">
        <div class="datebox" style="width:48px;height:48px;border-radius:50%"><b style="font-size:20px">${esc(r.name.charAt(0).toUpperCase())}</b></div>
        <div class="grow"><b>${esc(r.name)}</b><div class="small muted">${esc(r.discipline)} · ${esc(r.level)}${r.weight_kg ? ' · ' + esc(r.weight_kg) + ' kg' : ''}</div></div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="rider-edit" data-id="${r.id}">Edit</button></div></div>`).join('')}
      <button class="btn btn-ghost" type="button" data-act="rider-new" style="border-style:dashed">+ Add a rider</button>
    </section>
    <section class="card"><form data-form="profile" novalidate>
      <div class="section-label">Your details</div>
      <div class="field"><label for="pf-name">Full name</label><input id="pf-name" name="full_name" type="text" value="${esc(S.me.full_name)}" required></div>
      <div class="field"><label for="pf-phone">Mobile (WhatsApp)</label><input id="pf-phone" name="phone" type="tel" value="${esc(S.me.phone)}"></div>
      <div class="field"><span class="label">Email</span><span>${esc(S.me.email)}</span></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-navy" type="submit">Save details</button>
    </form></section>
    <section class="card"><form data-form="password" novalidate>
      <div class="section-label">Change password</div>
      <div class="field"><label for="pw-new">New password</label><input id="pw-new" name="password" type="password" autocomplete="new-password" minlength="6" required></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-ghost" type="submit">Update password</button>
    </form></section>
    <section class="card flat">
      ${[st.phone, st.phone2].filter(Boolean).map((ph) => `<div class="list-row"><span class="grow">Club phone</span><a href="tel:+${esc(phoneDigits(ph))}">${esc(ph)}</a></div>`).join('')}
      ${st.email ? `<div class="list-row"><span class="grow">Email</span><a href="mailto:${esc(st.email)}" class="small">${esc(st.email)}</a></div>` : ''}
      <div class="list-row"><span class="grow">Club hours</span><span class="small">6–9 am · 4–6 pm</span></div>
      ${st.address ? `<div class="list-row"><span class="grow">Address</span><span class="small" style="text-align:right">${esc(st.address)}</span></div>` : ''}
      <div class="list-row"><span class="grow">Cancellation</span><span class="small">Up to ${st.cancel_hours ?? 12} h before</span></div>
      <button class="list-row" type="button" data-act="signout" style="width:100%;border:0;background:none;color:var(--bad);font-weight:800;text-align:left">Sign out</button>
    </section>`;
}

// ---------------------------------------------------------------- sheets
function renderSheet() {
  if (!S.sheet) { $sheet.innerHTML = ''; return; }
  let inner = '';
  const t = S.sheet.type;
  if (t.startsWith('staff-')) inner = Staff.sheet();
  else inner = ({ book: sheetBook, norides: sheetNoRides, buy: sheetBuy, cancel: sheetCancel, rider: sheetRider })[t]?.() || '';
  $sheet.innerHTML = `<div class="scrim" data-scrim><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(S.sheet.title || 'Details')}"><div class="grab"></div>${inner}</div></div>`;
  const first = $sheet.querySelector('input:not([type=hidden]), select, textarea');
  if (first && S.sheet.focus !== false) setTimeout(() => first.focus({ preventScroll: true }), 50);
}
const sheetHead = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-act="close-sheet" aria-label="Close">${icon('close', 20)}</button></div>`;

function sheetBook() {
  const s = S.slots.find((x) => x.id === S.sheet.id);
  if (!s) return sheetHead('Session not found');
  const left = ridesLeft(s.kind);
  return `${sheetHead('Confirm booking')}
    <div class="summary">
      <div><span>When</span><b>${esc(fmtShortDay(s.starts_at))}, ${esc(fmtTime(s.starts_at))}</b></div>
      <div><span>Session</span><b>${esc(kindLabel(s.kind))} · ${s.duration_min} min</b></div>
      ${s.coach ? `<div><span>Coach</span><b>${esc(s.coach)}</b></div>` : ''}
      <div><span>Rider</span><b>${esc(riderName(S.book.rider))}</b></div>
      <div style="border-top:1px solid var(--line-2);padding-top:8px"><span>Uses</span><b>1 ${esc(kindLabel(s.kind).toLowerCase())} ride${left ? ` · ${left - 1} left after` : ''}</b></div>
    </div>
    <button class="btn btn-gold btn-block" type="button" data-act="confirm-book" data-id="${s.id}">Confirm booking</button>
    <button class="btn btn-ghost btn-block" type="button" data-act="close-sheet">Not now</button>`;
}
function sheetNoRides() {
  const pend = pendingMemberships().length;
  const k = S.sheet.kind;
  return `${sheetHead(k ? `No ${kindLabel(k).toLowerCase()} rides left` : 'You’re out of rides')}
    <p class="muted">${pend ? 'Your payment is waiting for the club to confirm. Once it’s confirmed you can book this ride.' : 'Buy a package to book this ride. The club confirms your payment, then the rides appear in your account.'}</p>
    ${S.packages.filter((p) => p.active && (!k || p.kind === k)).map((p) => `<div class="card"><div class="row"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${p.rides} ride${p.rides > 1 ? 's' : ''} · ${inr(p.price_inr)} + GST</div></div>
      <button class="btn btn-navy btn-sm" type="button" data-act="buy" data-id="${p.id}">Buy</button></div></div>`).join('')}
    <button class="btn btn-ghost btn-block" type="button" data-act="close-sheet">Not now</button>`;
}
function sheetBuy() {
  const p = S.packages.find((x) => x.id === S.sheet.id);
  if (!p) return sheetHead('Package not found');
  const st = S.settings || {};
  const pct = gstPct();
  const total = gstTotal(p.price_inr, pct);
  const upi = upiLink({ upiId: st.upi_id, payee: st.upi_payee || club(), amount: total, note: p.name });
  return `${sheetHead(p.name)}
    <div class="summary"><div><span>Discipline</span><b>${esc(kindLabel(p.kind))}</b></div><div><span>Rides</span><b>${p.rides}</b></div><div><span>Use within</span><b>${p.validity_days} days</b></div>
      <div><span>Price</span><b class="num">${inr(p.price_inr)}</b></div>${pct ? `<div><span>GST ${pct}%</span><b class="num">${inr(total - p.price_inr)}</b></div>` : ''}
      <div style="border-top:1px solid var(--line-2);padding-top:8px"><span>Total to pay</span><b class="num" style="font-size:17px">${inr(total)}</b></div></div>
    ${upi ? `<div class="stack tight"><div class="section-label">Step 1 · Pay</div>
      <a class="btn btn-gold btn-block" href="${esc(upi)}">Pay ${inr(total)} with a UPI app</a>
      <div class="split small"><span class="muted">Or pay to UPI ID <b style="color:var(--ink)">${esc(st.upi_id)}</b></span>
      <button class="btn btn-ghost btn-sm" type="button" data-act="copy" data-text="${esc(st.upi_id)}">Copy</button></div></div>` : ''}
    <form data-form="pay" novalidate>
      <input type="hidden" name="package_id" value="${p.id}">
      <div class="section-label">${upi ? 'Step 2 · ' : ''}Tell the club how you paid</div>
      <div class="field"><label for="pay-method">Payment method</label>
        <select id="pay-method" name="method">${st.upi_id ? '<option value="upi">UPI</option>' : ''}<option value="bank">Bank transfer</option><option value="cash">Cash at the club</option><option value="card">Card at the club</option></select></div>
      <div class="field"><label for="pay-ref">Transaction ID (UTR) or receipt number</label><input id="pay-ref" name="ref" type="text" maxlength="80" placeholder="e.g. 4321 8765 0912"><span class="hint">Helps the club match your payment. Leave blank for cash.</span></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-navy btn-block" type="submit">Send for confirmation</button>
    </form>`;
}
function sheetCancel() {
  const b = S.bookings.find((x) => x.id === S.sheet.id);
  if (!b) return sheetHead('Booking not found');
  const hrs = S.settings?.cancel_hours ?? 12;
  const late = new Date(b.sessions.starts_at) - Date.now() < hrs * 3600e3;
  return `${sheetHead('Cancel this ride?')}
    <div class="summary"><div><span>When</span><b>${esc(fmtShortDay(b.sessions.starts_at))}, ${esc(fmtTime(b.sessions.starts_at))}</b></div>
      <div><span>Rider</span><b>${esc(b.riders?.name || '')}</b></div></div>
    ${late ? `<div class="form-error">It’s less than ${hrs} hours to the ride, so it can’t be cancelled in the app. Please call or WhatsApp the club.</div>`
      : `<p class="muted">The ride goes back to your package.</p><button class="btn btn-danger btn-block" type="button" data-act="confirm-cancel" data-id="${b.id}">Yes, cancel the ride</button>`}
    <button class="btn btn-ghost btn-block" type="button" data-act="close-sheet">Keep my booking</button>`;
}
function sheetRider() {
  const r = S.sheet.id ? S.riders.find((x) => x.id === S.sheet.id) : null;
  const opt = (v, cur) => `<option ${v === cur ? 'selected' : ''}>${v}</option>`;
  return `${sheetHead(r ? 'Edit rider' : 'Add a rider')}
    <form data-form="rider" novalidate>
      <input type="hidden" name="id" value="${r ? r.id : ''}">
      <div class="field"><label for="rd-name">Name</label><input id="rd-name" name="name" type="text" maxlength="80" value="${esc(r?.name || '')}" required></div>
      <div class="grid2">
        <div class="field"><label for="rd-disc">Rides for</label><select id="rd-disc" name="discipline">${['Polo', 'Riding', 'Jumping'].map((v) => opt(v, r?.discipline || 'Polo')).join('')}</select></div>
        <div class="field"><label for="rd-level">Level</label><select id="rd-level" name="level">${['Beginner', 'Intermediate', 'Advanced'].map((v) => opt(v, r?.level || 'Beginner')).join('')}</select></div>
      </div>
      <div class="field"><label for="rd-w">Weight (kg)</label><input id="rd-w" name="weight_kg" type="number" inputmode="decimal" min="10" max="200" step="0.5" value="${esc(r?.weight_kg ?? '')}"><span class="hint">Helps the yard choose the right horse.</span></div>
      <div class="form-error" hidden></div>
      <button class="btn btn-gold btn-block" type="submit">${r ? 'Save' : 'Add rider'}</button>
      ${r ? `<button class="btn btn-danger btn-block" type="button" data-act="rider-remove" data-id="${r.id}">Remove rider</button>` : ''}
    </form>`;
}

// ---------------------------------------------------------------- actions
const ACTS = {
  async tab(d) {
    S.tab = d.tab; closeSheet();
    try { history.replaceState(null, '', '#' + d.tab); } catch { /* ignore */ }
    window.scrollTo(0, 0);
    if (d.tab === 'staff') { render(); await Staff.load(); }
    render();
  },
  'auth-view'(d) { S.authView = d.view; S.authMsg = ''; render(); },
  async 'demo-login'(d) { await S.api.demoSignIn(d.id); },
  async signout() { closeSheet(); S.me = null; await S.api.signOut(); },
  'close-sheet'() { closeSheet(); },
  'pick-rider'(d) { S.book.rider = d.id; S.book.kind = riderKind(d.id); render(); },
  'pick-day'(d) { S.book.day = d.day; render(); },
  'pick-kind'(d) { S.book.kind = d.kind; render(); },
  'ask-book'(d) { if (!S.book.rider) return openSheet({ type: 'rider', title: 'Add a rider' }); openSheet({ type: 'book', id: d.id, title: 'Confirm booking', focus: false }); },
  async 'confirm-book'(d) {
    const s = S.slots.find((x) => x.id === d.id);
    try {
      await S.api.book(d.id, S.book.rider);
    } catch (e) {
      if (e.hint === 'no_rides' || /rides left on a valid/i.test(e.message)) { openSheet({ type: 'norides', kind: s?.kind, title: 'Out of rides', focus: false }); return; }
      throw e;
    }
    closeSheet();
    toast(`Booked: ${fmtShortDay(s.starts_at)}, ${fmtTime(s.starts_at)} for ${riderName(S.book.rider)}`);
    await refreshAll();
  },
  'ask-cancel'(d) { openSheet({ type: 'cancel', id: d.id, title: 'Cancel ride', focus: false }); },
  async 'confirm-cancel'(d) { await S.api.cancel(d.id); closeSheet(); toast('Cancelled. The ride is back in your package.'); await refreshAll(); },
  async 'waitlist-join'(d) { await S.api.joinWaitlist(d.id, S.book.rider); toast('You’re on the waitlist. The club will contact you if a seat opens.'); S.waitlist = await S.api.myWaitlist(); await loadSlots(); render(); },
  async 'waitlist-leave'(d) { await S.api.leaveWaitlist(d.id, S.book.rider); toast('Left the waitlist.'); S.waitlist = await S.api.myWaitlist(); await loadSlots(); render(); },
  buy(d) { openSheet({ type: 'buy', id: d.id, title: 'Buy package', focus: false }); },
  async copy(d) {
    try { await navigator.clipboard.writeText(d.text); toast('Copied ' + d.text); } catch { toast('Copy failed. Select the text and copy it instead.', true); }
  },
  'rider-new'() { openSheet({ type: 'rider', title: 'Add a rider' }); },
  'rider-edit'(d) { openSheet({ type: 'rider', id: d.id, title: 'Edit rider' }); },
  async 'rider-remove'(d) { await S.api.saveRider({ id: d.id, active: false }); closeSheet(); toast('Rider removed.'); await refreshAll(); },
};

const FORMS = {
  async signin(v) {
    if (!v.email || !v.password) throw new Error('Enter your email and password.');
    await S.api.signIn(v.email.trim(), v.password);
  },
  async signup(v) {
    if (!v.full_name?.trim() || !v.email?.trim() || !v.phone?.trim()) throw new Error('Fill in your name, mobile number and email.');
    if ((v.password || '').length < 6) throw new Error('Use a password of at least 6 characters.');
    const res = await S.api.signUp(v.email.trim(), v.password, v.full_name.trim(), v.phone.trim());
    if (!res?.session) { S.authView = 'signin'; S.authMsg = 'Account created. Check your email to confirm it, then sign in.'; render(); }
  },
  async forgot(v) {
    if (!v.email) throw new Error('Enter your email.');
    await S.api.resetPassword(v.email.trim());
    S.authMsg = 'If that email has an account, a reset link is on its way.'; render();
  },
  async newpass(v) {
    if ((v.password || '').length < 6) throw new Error('Use a password of at least 6 characters.');
    await S.api.updatePassword(v.password); S.view = 'app'; toast('Password updated.'); await refreshAll();
  },
  async password(v, f) {
    if ((v.password || '').length < 6) throw new Error('Use a password of at least 6 characters.');
    await S.api.updatePassword(v.password); f.reset(); toast('Password updated.');
  },
  async profile(v) {
    if (!v.full_name?.trim()) throw new Error('Enter your name.');
    await S.api.updateMe({ full_name: v.full_name.trim(), phone: (v.phone || '').trim() });
    S.me = await S.api.me(); toast('Details saved.'); render();
  },
  async rider(v) {
    if (!v.name?.trim()) throw new Error('Enter the rider’s name.');
    const r = { name: v.name.trim(), discipline: v.discipline, level: v.level, weight_kg: v.weight_kg ? Number(v.weight_kg) : null };
    if (v.id) r.id = v.id;
    await S.api.saveRider(r);
    closeSheet(); toast(v.id ? 'Rider updated.' : `${r.name} added.`);
    await loadMember();
    if (!v.id && !S.book.rider) S.book.rider = S.riders[0]?.id || null;
    if (!v.id) S.book.rider = S.riders.find((x) => x.name === r.name)?.id || S.book.rider;
    render();
  },
  async pay(v) {
    if (v.method === 'upi' && !(v.ref || '').trim()) throw new Error('Enter the UPI transaction ID so the club can find your payment.');
    await S.api.requestPackage(v.package_id, v.method, (v.ref || '').trim());
    closeSheet(); S.tab = 'packages';
    toast('Sent. The club will confirm your payment and add the rides.');
    await refreshAll();
  },
};

// ---------------------------------------------------------------- events
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-scrim]')) { closeSheet(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTS[el.dataset.act] || Staff.acts[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  const isBtn = el.tagName === 'BUTTON';
  if (isBtn) el.disabled = true;
  try { await fn({ ...el.dataset }, el); } catch (err) { console.error(err); toast(errMsg(err), true); } finally { if (isBtn && el.isConnected) el.disabled = false; }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form] || Staff.forms[f.dataset.form];
  if (!fn) return;
  const btn = f.querySelector('[type=submit]');
  const errBox = f.querySelector('.form-error');
  if (errBox) errBox.hidden = true;
  if (btn) btn.disabled = true;
  const fd = new FormData(f);
  try { await fn(Object.fromEntries(fd), f, fd); } catch (err) {
    console.error(err);
    if (errBox && errBox.isConnected) { errBox.textContent = errMsg(err); errBox.hidden = false; } else toast(errMsg(err), true);
  } finally { if (btn && btn.isConnected) btn.disabled = false; }
});
document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = Staff.changes[el.dataset.change];
  if (!fn) return;
  try { await fn(el); } catch (err) { console.error(err); toast(errMsg(err), true); }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el) Staff.inputs[el.dataset.input]?.(el);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); });

// ---------------------------------------------------------------- boot
async function onSignedIn(user) {
  if (S.loadingUser === user.id || S.me?.id === user.id) return;
  S.loadingUser = user.id; S.user = user; S.me = null;
  render();
  try {
    await Promise.all([loadMember(), loadSlots()]);
    if (S.tab === 'staff' && isStaff()) await Staff.load(); else if (isStaff()) await Staff.loadBadge().catch(() => {});
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="boot"><img src="img/logo.jpg" alt=""><p>${esc(errMsg(err))}</p><button class="btn btn-gold" type="button" onclick="location.reload()">Try again</button></div>`;
    S.loadingUser = null; return;
  }
  S.loadingUser = null;
  render();
}

async function boot() {
  try {
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
      const m = await import('./api-supabase.js');
      S.api = m.createApi(cfg.SUPABASE_URL.trim(), cfg.SUPABASE_ANON_KEY.trim());
    } else {
      const m = await import('./api-demo.js');
      S.api = m.createDemoApi();
    }
  } catch (err) {
    $app.innerHTML = `<div class="boot"><p>Couldn’t start the app. Check your internet connection and reload.</p></div>`;
    console.error(err); return;
  }
  const h = (location.hash || '').slice(1);
  if (TABS.includes(h)) S.tab = h;

  S.api.onAuth((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.view = 'reset'; S.user = session?.user || S.user; render(); return; }
    if (event === 'SIGNED_OUT' || !session) { S.user = null; S.me = null; S.loadingUser = null; S.authView = 'signin'; render(); return; }
    if (session?.user) onSignedIn(session.user);
  });
  try { S.settings = await S.api.settings(); } catch { /* settings are optional on the sign-in screen */ }
  const session = await S.api.getSession();
  if (session?.user && S.view !== 'reset') await onSignedIn(session.user); else render();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
boot();
