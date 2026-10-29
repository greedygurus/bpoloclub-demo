// Staff and admin screens: today's yard sheet, payments, members, schedule, setup.
import { esc, istDate, addDays, dayRange, fmtTime, fmtLongDay, fmtShortDay, fmtDateOnly, fmtDayFromStr, inr, kindLabel, KINDS, CLUB_SLOTS, firstName, waLink, icon } from './util.js';

export function staffModule(ctx) {
  const { S } = ctx;
  const api = () => ctx.api;
  const st = (S.st = {
    sub: 'today', day: istDate(), sessions: [], bookings: [], waitlist: [], horses: [], allRiders: [],
    pending: [], members: [], balances: [], riderCounts: [], packagesAll: [], closures: [], upcoming: [], q: '',
  });
  const isAdmin = () => S.me?.role === 'admin';
  const today = () => istDate();
  const memberById = (id) => st.members.find((m) => m.id === id);
  const methodLabel = (m) => ({ upi: 'UPI', cash: 'Cash', bank: 'Bank transfer', card: 'Card', other: 'Other' }[m] || m);

  // ------------------------------------------------------------ loading
  async function loadBadge() { st.pending = await api().pending(); }
  async function load() {
    const a = api();
    const tasks = [loadBadge()];
    if (st.sub === 'today') {
      const r = dayRange(st.day);
      tasks.push(
        a.daySessions(r.from, r.to).then((x) => (st.sessions = x)),
        a.dayBookings(r.from, r.to).then((x) => (st.bookings = x)),
        a.dayWaitlist(r.from, r.to).then((x) => (st.waitlist = x)),
        a.horses().then((x) => (st.horses = x)),
        a.allRiders().then((x) => (st.allRiders = x)),
        a.closures(st.day, addDays(st.day, 1)).then((x) => (st.closures = x)),
      );
    }
    if (st.sub === 'payments' || st.sub === 'members') {
      tasks.push(a.members().then((x) => (st.members = x)), a.packages().then((x) => (st.packagesAll = x)));
    }
    if (st.sub === 'members') {
      tasks.push(a.allBalances().then((x) => (st.balances = x)), a.riderCounts().then((x) => (st.riderCounts = x)));
    }
    if (st.sub === 'schedule') {
      const r = dayRange(today(), 14);
      tasks.push(a.closures(today(), addDays(today(), 366)).then((x) => (st.closures = x)), a.slots(r.from, r.to).then((x) => (st.upcoming = x)));
    }
    if (st.sub === 'setup') {
      tasks.push(a.horses().then((x) => (st.horses = x)), a.packages().then((x) => (st.packagesAll = x)), a.settings().then((x) => (S.settings = x)));
    }
    await Promise.all(tasks);
  }
  async function reload() { await load(); ctx.render(); }

  // ------------------------------------------------------------ render
  function render() {
    const subs = [['today', 'Today'], ['payments', 'Payments'], ['members', 'Members'], ['schedule', 'Schedule'], ['setup', 'Setup']];
    const nav = `<nav class="subnav" aria-label="Staff sections">${subs.map(([k, l]) =>
      `<button type="button" data-act="st-sub" data-sub="${k}" ${st.sub === k ? 'aria-current="page"' : ''}>${l}${k === 'payments' && st.pending.length ? ` <span class="badge">${st.pending.length}</span>` : ''}</button>`).join('')}</nav>`;
    const body = { today: todayView, payments: paymentsView, members: membersView, schedule: scheduleView, setup: setupView }[st.sub]();
    return `<div class="split"><h1>Staff</h1><span class="pill info">${esc(S.me.role === 'admin' ? 'Admin' : 'Staff')}</span></div>${nav}${body}`;
  }

  // ---- Today
  function horseLoad() {
    const load = {};
    st.bookings.forEach((b) => { if (b.horse_id) load[b.horse_id] = (load[b.horse_id] || 0) + 1; });
    return load;
  }
  function todayView() {
    const load = horseLoad();
    const live = st.sessions.filter((s) => !s.cancelled);
    const seats = live.reduce((n, s) => n + s.capacity, 0);
    const booked = st.bookings.length;
    const attended = st.bookings.filter((b) => b.status === 'attended').length;
    const marked = st.bookings.filter((b) => b.status !== 'booked').length;
    const atLimit = st.horses.filter((h) => h.active && (load[h.id] || 0) >= h.daily_limit).length;
    const closure = st.closures.find((c) => c.day === st.day);

    const controls = `<div class="row" style="flex-wrap:wrap">
      <button class="icon-btn" type="button" data-act="st-day" data-delta="-1" aria-label="Previous day">${icon('left', 20)}</button>
      <input type="date" value="${st.day}" data-change="st-date" aria-label="Day" style="max-width:180px">
      <button class="icon-btn" type="button" data-act="st-day" data-delta="1" aria-label="Next day">${icon('right', 20)}</button>
      ${st.day !== today() ? '<button class="btn btn-ghost btn-sm" type="button" data-act="st-day" data-delta="0">Today</button>' : ''}
      <span class="muted strong small">${esc(fmtLongDay(st.day + 'T12:00:00+05:30'))}</span></div>`;

    const stats = `<div class="stats">
      <div class="stat"><span>Seats booked</span><b class="num">${booked}<small class="muted" style="font-size:15px;font-family:var(--body)"> / ${seats}</small></b></div>
      <div class="stat"><span>Checked in</span><b class="num">${attended}<small class="muted" style="font-size:15px;font-family:var(--body)"> of ${booked}</small></b></div>
      <div class="stat"><span>Still to mark</span><b class="num">${booked - marked}</b></div>
      <div class="stat dark"><span>Horses at limit</span><b class="num">${atLimit}</b></div></div>`;

    const sessions = st.sessions.length ? st.sessions.map((s) => sessionCard(s, load)).join('')
      : `<div class="empty"><h3>${closure ? 'Club closed' : 'No sessions this day'}</h3><p class="muted small">${closure ? esc(closure.reason) : 'Create sessions under Schedule.'}</p></div>`;

    const horses = `<section class="card"><h2>Horse workload</h2><p class="small muted">The horse list only offers horses under their daily limit.</p>
      ${st.horses.filter((h) => h.active).map((h) => {
        const n = load[h.id] || 0; const over = n >= h.daily_limit;
        return `<div class="load"><div class="split small strong"><span>${esc(h.name)}</span><span class="num" style="color:${over ? 'var(--bad)' : 'inherit'}">${n} / ${h.daily_limit}</span></div>
          <div class="bar ${over ? 'full' : ''}"><span style="width:${Math.min(100, Math.round((n / h.daily_limit) * 100))}%"></span></div></div>`;
      }).join('') || '<p class="small muted">Add horses under Setup.</p>'}
      ${st.horses.filter((h) => !h.active).map((h) => `<div class="split small"><span>${esc(h.name)}</span><span class="muted">Resting${h.notes ? ' · ' + esc(h.notes) : ''}</span></div>`).join('')}
    </section>`;

    return `${controls}${closure ? `<div class="card note"><b>Closed: ${esc(closure.reason)}</b></div>` : ''}${stats}
      <div class="staff-cols"><div class="main-col">${sessions}</div><div class="side-col">${horses}</div></div>`;
  }

  function sessionCard(s, load) {
    const rows = st.bookings.filter((b) => b.session_id === s.id);
    const wl = st.waitlist.filter((w) => w.session_id === s.id);
    const active = st.horses.filter((h) => h.active);
    const riderRow = (b) => {
      const opts = active.map((h) => {
        const n = load[h.id] || 0; const sel = b.horse_id === h.id;
        return `<option value="${h.id}" ${sel ? 'selected' : ''} ${!sel && n >= h.daily_limit ? 'disabled' : ''}>${esc(h.name)} (${n}/${h.daily_limit})</option>`;
      }).join('');
      const phone = b.profiles?.phone;
      return `<div class="rider-line">
        <div><b>${esc(b.riders?.name || 'Rider')}</b> <span class="small muted">${esc(b.riders?.level || '')}${b.riders?.weight_kg ? ' · ' + esc(b.riders.weight_kg) + ' kg' : ''}</span>
          <div class="tiny muted">${esc(b.profiles?.full_name || '')}${phone ? ` · <a href="${esc(waLink(phone, ''))}" target="_blank" rel="noopener">${esc(phone)}</a>` : ''}</div></div>
        <select data-change="st-horse" data-id="${b.id}" aria-label="Horse for ${esc(b.riders?.name || 'rider')}"><option value="">Horse…</option>${opts}</select>
        <div class="seg" role="group" aria-label="Attendance">
          <button type="button" class="att" data-act="st-mark" data-id="${b.id}" data-status="${b.status === 'attended' ? 'booked' : 'attended'}" aria-pressed="${b.status === 'attended'}">Here</button>
          <button type="button" class="ns" data-act="st-mark" data-id="${b.id}" data-status="${b.status === 'no_show' ? 'booked' : 'no_show'}" aria-pressed="${b.status === 'no_show'}">No-show</button>
        </div>
        <input class="note-in" type="text" maxlength="300" placeholder="Coach note for the rider (they see this)" value="${esc(b.coach_note || '')}" data-change="st-note" data-id="${b.id}" aria-label="Coach note">
      </div>`;
    };
    return `<section class="card" style="${s.cancelled ? 'opacity:.6' : ''}">
      <div class="sess-head"><div><h3 class="num">${esc(fmtTime(s.starts_at))} · ${esc(kindLabel(s.kind))}</h3>
        <div class="small muted">${esc(s.level)}${s.coach ? ' · ' + esc(s.coach) : ''} · ${s.duration_min} min</div></div>
        <div class="row">${s.cancelled ? '<span class="pill bad">Cancelled</span>' : `<span class="pill ${rows.length >= s.capacity ? 'bad' : 'info'} num">${rows.length} / ${s.capacity}</span>`}</div></div>
      ${rows.length ? rows.map(riderRow).join('') : (s.cancelled ? '' : '<p class="small muted">No riders booked yet.</p>')}
      ${wl.length ? `<div class="small"><b>Waitlist:</b> ${wl.map((w) => `${esc(w.riders?.name || '')}${w.profiles?.phone ? ` (<a href="${esc(waLink(w.profiles.phone, `Hi ${firstName(w.profiles.full_name)}, a seat has opened on ${fmtShortDay(s.starts_at)} at ${fmtTime(s.starts_at)}. Reply to confirm.`))}" target="_blank" rel="noopener">WhatsApp</a>)` : ''}`).join(', ')}</div>` : ''}
      ${s.cancelled ? '' : `<div class="row" style="flex-wrap:wrap">
        ${new Date(s.starts_at) > new Date() && rows.length < s.capacity ? `<button class="btn btn-ghost btn-sm" type="button" data-act="st-add-rider" data-id="${s.id}">+ Book a rider</button>` : ''}
        <button class="btn btn-danger btn-sm" type="button" data-act="st-ask-cancel-session" data-id="${s.id}">Cancel session</button></div>`}
    </section>`;
  }

  // ---- Payments
  function paymentsView() {
    const pend = st.pending.map((m) => {
      const p = memberById(m.account_id) || {};
      return `<section class="card"><div class="split"><div><b>${esc(p.full_name || 'Member')}</b><div class="tiny muted">${esc(p.phone || '')}${p.email ? ' · ' + esc(p.email) : ''}</div></div><span class="pill warn">Waiting</span></div>
        <div class="summary"><div><span>Package</span><b>${esc(kindLabel(m.kind))} · ${esc(m.package_name)} · ${m.rides_total} rides</b></div>
          <div><span>Amount</span><b class="num">${inr(m.price_inr)} + GST</b></div>
          <div><span>Paid by</span><b>${esc(methodLabel(m.payment_method))}${m.payment_ref ? ' · ' + esc(m.payment_ref) : ''}</b></div>
          <div><span>Sent</span><b>${esc(fmtShortDay(m.requested_at))}, ${esc(fmtTime(m.requested_at))}</b></div></div>
        <form data-form="st-approve" class="row" style="flex-wrap:wrap;align-items:flex-end">
          <input type="hidden" name="id" value="${m.id}">
          <div class="field grow" style="min-width:150px"><label for="ap-${m.id}">Package starts</label><input id="ap-${m.id}" name="start" type="date" value="${today()}"></div>
          <button class="btn btn-gold" type="submit">Payment received · activate</button>
          <button class="btn btn-danger" type="button" data-act="st-reject" data-id="${m.id}">Not received</button>
        </form></section>`;
    }).join('');
    const memberOpts = st.members.map((m) => `<option value="${m.id}">${esc(m.full_name || m.email)}${m.phone ? ' · ' + esc(m.phone) : ''}</option>`).join('');
    const pkgOpts = st.packagesAll.filter((p) => p.active).map((p) => `<option value="${p.id}">${esc(kindLabel(p.kind))} · ${esc(p.name)} · ${p.rides} rides · ${inr(p.price_inr)}</option>`).join('');
    return `<section class="stack"><h2>Waiting for confirmation</h2>
        <p class="small muted">Check the money has arrived in the club’s account, then activate. The member’s rides appear straight away.</p>
        ${pend || '<div class="empty"><p class="muted">No payments waiting.</p></div>'}</section>
      <section class="card"><h2>Record a payment at the desk</h2>
        <form data-form="st-add-membership">
          <div class="field"><label for="am-member">Member</label><select id="am-member" name="account" required><option value="">Choose a member…</option>${memberOpts}</select></div>
          <div class="field"><label for="am-pkg">Package</label><select id="am-pkg" name="package" required>${pkgOpts || '<option value="">Add packages under Setup first</option>'}</select></div>
          <div class="grid2"><div class="field"><label for="am-method">Paid by</label><select id="am-method" name="method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="card">Card</option></select></div>
          <div class="field"><label for="am-start">Starts</label><input id="am-start" name="start" type="date" value="${today()}"></div></div>
          <div class="field"><label for="am-ref">Receipt or transaction number</label><input id="am-ref" name="ref" type="text" maxlength="80"></div>
          <div class="form-error" hidden></div>
          <button class="btn btn-navy" type="submit">Add package to member</button>
        </form></section>`;
  }

  // ---- Members
  function memberRows() {
    const q = st.q.trim().toLowerCase();
    const counts = {};
    st.riderCounts.forEach((r) => { counts[r.account_id] = (counts[r.account_id] || 0) + 1; });
    const t = today();
    const list = st.members.filter((m) => !q || [m.full_name, m.phone, m.email].some((x) => String(x || '').toLowerCase().includes(q)));
    if (!list.length) return '<tr><td colspan="5" class="muted">No members match.</td></tr>';
    return list.map((m) => {
      const act = st.balances.filter((b) => b.account_id === m.id && b.status === 'active' && b.expires_on >= t).sort((a, b) => a.expires_on.localeCompare(b.expires_on));
      const pend = st.balances.some((b) => b.account_id === m.id && b.status === 'pending');
      const left = act.reduce((n, b) => n + b.rides_left, 0);
      const soon = act[0] && (act[0].expires_on <= addDays(t, 7) || left <= 2);
      const pkg = act.length ? `<b class="num">${left} left</b><div class="tiny muted">till ${esc(fmtDateOnly(act[act.length - 1].expires_on))}</div>`
        : pend ? '<span class="pill warn">Payment waiting</span>' : '<span class="muted small">None</span>';
      const msg = act.length
        ? `Hi ${firstName(m.full_name)}, this is ${S.settings?.club_name || 'the club'}. Your ${act[0].package_name} has ${left} ride${left === 1 ? '' : 's'} left and runs till ${fmtDateOnly(act[0].expires_on)}. Reply here to renew.`
        : `Hi ${firstName(m.full_name)}, this is ${S.settings?.club_name || 'the club'}. We’d love to see you back in the saddle. Reply here and we’ll set up your next package.`;
      const wa = waLink(m.phone, msg);
      const role = isAdmin() && m.id !== S.me.id
        ? `<select data-change="st-role" data-id="${m.id}" aria-label="Role for ${esc(m.full_name)}" style="min-height:38px;font-size:14px;padding:4px 8px">${['member', 'staff', 'admin'].map((r) => `<option ${m.role === r ? 'selected' : ''} value="${r}">${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select>`
        : `<span class="small">${esc(m.role[0].toUpperCase() + m.role.slice(1))}</span>`;
      return `<tr><td><b>${esc(m.full_name || '—')}</b><div class="tiny muted">${esc(m.phone || '')}${m.email ? ' · ' + esc(m.email) : ''}</div></td>
        <td class="num">${counts[m.id] || 0}</td><td>${pkg}</td><td>${role}</td>
        <td>${wa ? `<a class="btn btn-sm ${soon ? 'btn-gold' : 'btn-ghost'}" href="${esc(wa)}" target="_blank" rel="noopener">${icon('chat', 16)} ${soon ? 'Renewal reminder' : 'WhatsApp'}</a>` : '<span class="tiny muted">No phone</span>'}</td></tr>`;
    }).join('');
  }
  function membersView() {
    return `<section class="card"><div class="split"><h2>Members</h2><span class="small muted">${st.members.length} accounts</span></div>
      <div class="field"><label for="mem-q" class="sr">Search members</label><input id="mem-q" type="text" placeholder="Search by name, phone or email" value="${esc(st.q)}" data-input="st-search"></div>
      <div class="table-wrap"><table><thead><tr><th>Member</th><th>Riders</th><th>Rides</th><th>Role</th><th>Message</th></tr></thead>
      <tbody id="member-rows">${memberRows()}</tbody></table></div>
      ${isAdmin() ? '<p class="tiny muted">Staff can run the yard sheet, payments and schedule. Admins can also change packages, club details and roles.</p>' : ''}</section>`;
  }

  // ---- Schedule
  function scheduleView() {
    const days = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
    const upcoming = st.upcoming.filter((s) => !s.cancelled);
    return `<div class="staff-cols"><div class="main-col">
      <section class="card"><h2>Add sessions</h2><p class="small muted">Creates a session at each ticked time, on each chosen weekday between the two dates. Do this once per discipline. Closed days are skipped, and existing sessions aren’t duplicated.</p>
        <form data-form="st-create">
          <div class="grid2"><div class="field"><label for="cs-from">From</label><input id="cs-from" name="from" type="date" value="${today()}" required></div>
          <div class="field"><label for="cs-to">To</label><input id="cs-to" name="to" type="date" value="${addDays(today(), 27)}" required></div></div>
          <div class="field"><span class="label">Days</span><div class="checks">${days.map(([n, l]) => `<label class="check"><input type="checkbox" name="weekday" value="${n}" checked>${l}</label>`).join('')}</div></div>
          <div class="field"><span class="label">Start times (club hours 6–9 am, 4–6 pm)</span><div class="checks">${CLUB_SLOTS.map((t) => `<label class="check"><input type="checkbox" name="slot" value="${t}" checked>${esc(fmtTime('2026-01-01T' + t + ':00+05:30'))}</label>`).join('')}</div></div>
          <div class="grid2"><div class="field"><label for="cs-time">Extra start time (optional)</label><input id="cs-time" name="time" type="time"></div>
          <div class="field"><label for="cs-dur">Length (minutes)</label><input id="cs-dur" name="duration" type="number" min="15" max="480" step="5" value="60"></div></div>
          <div class="grid2"><div class="field"><label for="cs-kind">Type</label><select id="cs-kind" name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
          <div class="field"><label for="cs-cap">Riders (max)</label><input id="cs-cap" name="capacity" type="number" min="1" max="50" value="6" required></div></div>
          <div class="grid2"><div class="field"><label for="cs-level">Level</label><input id="cs-level" name="level" type="text" value="All levels"></div>
          <div class="field"><label for="cs-coach">Coach</label><input id="cs-coach" name="coach" type="text" placeholder="Coach name"></div></div>
          <div class="form-error" hidden></div>
          <button class="btn btn-gold" type="submit">Create sessions</button>
        </form></section>
      <section class="card"><h2>Next 14 days</h2>
        ${upcoming.length ? `<div class="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Session</th><th>Booked</th><th></th></tr></thead><tbody>
          ${upcoming.map((s) => `<tr><td>${esc(fmtShortDay(s.starts_at))}</td><td class="num">${esc(fmtTime(s.starts_at))}</td>
            <td>${esc(kindLabel(s.kind))}<div class="tiny muted">${esc(s.level)}${s.coach ? ' · ' + esc(s.coach) : ''}</div></td>
            <td class="num">${s.booked}/${s.capacity}${s.waitlisted ? ` <span class="tiny muted">+${s.waitlisted} waiting</span>` : ''}</td>
            <td><button class="btn btn-danger btn-sm" type="button" data-act="st-ask-cancel-session" data-id="${s.id}">Cancel</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted small">No sessions in the next 14 days.</p>'}</section>
    </div><div class="side-col">
      <section class="card"><h2>Close the club for a day</h2><p class="small muted">Cancels every session that day and returns the rides to members.</p>
        <form data-form="st-closure">
          <div class="field"><label for="cl-day">Day</label><input id="cl-day" name="day" type="date" min="${today()}" required></div>
          <div class="field"><label for="cl-reason">Reason members will see</label><input id="cl-reason" name="reason" type="text" maxlength="120" placeholder="e.g. Farrier day, Diwali"></div>
          <div class="form-error" hidden></div>
          <button class="btn btn-navy" type="submit">Close this day</button>
        </form>
        ${st.closures.length ? `<div class="stack tight">${st.closures.map((c) => `<div class="split small"><span><b>${esc(fmtDayFromStr(c.day))}</b> · ${esc(c.reason)}</span>
          <button class="link-btn" type="button" data-act="st-remove-closure" data-day="${c.day}">Reopen</button></div>`).join('')}</div>` : ''}
      </section></div></div>`;
  }

  // ---- Setup
  function setupView() {
    const s = S.settings || {};
    const settingsForm = isAdmin() ? `<section class="card"><h2>Club details</h2>
      <form data-form="st-settings">
        <div class="grid2"><div class="field"><label for="se-name">Club name</label><input id="se-name" name="club_name" type="text" value="${esc(s.club_name)}"></div>
        <div class="field"><label for="se-tag">Tagline</label><input id="se-tag" name="tagline" type="text" value="${esc(s.tagline)}"></div></div>
        <div class="grid2"><div class="field"><label for="se-phone">Phone</label><input id="se-phone" name="phone" type="tel" value="${esc(s.phone)}"></div>
        <div class="field"><label for="se-phone2">Second phone</label><input id="se-phone2" name="phone2" type="tel" value="${esc(s.phone2)}"></div></div>
        <div class="grid2"><div class="field"><label for="se-wa">WhatsApp number</label><input id="se-wa" name="whatsapp" type="tel" value="${esc(s.whatsapp)}"></div>
        <div class="field"><label for="se-email">Email</label><input id="se-email" name="email" type="email" value="${esc(s.email)}"></div></div>
        <div class="field"><label for="se-addr">Address</label><input id="se-addr" name="address" type="text" value="${esc(s.address)}"></div>
        <div class="field"><label for="se-maps">Google Maps link</label><input id="se-maps" name="maps_url" type="text" inputmode="url" value="${esc(s.maps_url)}"></div>
        <div class="grid2"><div class="field"><label for="se-upi">UPI ID for payments</label><input id="se-upi" name="upi_id" type="text" value="${esc(s.upi_id)}" placeholder="clubname@okhdfcbank"></div>
        <div class="field"><label for="se-payee">Name on UPI account</label><input id="se-payee" name="upi_payee" type="text" value="${esc(s.upi_payee)}"></div></div>
        <div class="grid2"><div class="field"><label for="se-cancel">Members can cancel up to (hours before)</label><input id="se-cancel" name="cancel_hours" type="number" min="0" max="72" value="${esc(s.cancel_hours)}"></div>
        <div class="field"><label for="se-gst">GST added to package prices (%)</label><input id="se-gst" name="gst_percent" type="number" min="0" max="40" step="0.5" value="${esc(s.gst_percent ?? 18)}"></div></div>
        <div class="field"><label for="se-extras">“Also at the club” (shown under Packages)</label><textarea id="se-extras" name="extras" maxlength="800">${esc(s.extras)}</textarea></div>
        <div class="field"><label for="se-notice">Notice on members’ home screen</label><textarea id="se-notice" name="notice" maxlength="400" placeholder="Leave empty for none">${esc(s.notice)}</textarea></div>
        <div class="form-error" hidden></div>
        <button class="btn btn-gold" type="submit">Save club details</button>
      </form></section>` : '';
    const pk = isAdmin() ? `<section class="card"><div class="split"><h2>Packages</h2><button class="btn btn-navy btn-sm" type="button" data-act="st-edit-package">+ Add package</button></div>
      ${st.packagesAll.length ? st.packagesAll.map((p) => `<div class="split" style="border-top:1px solid var(--line-2);padding-top:10px">
        <div><b>${esc(p.name)}</b> ${p.active ? '' : '<span class="pill info">Hidden</span>'}<div class="small muted">${esc(kindLabel(p.kind))} · ${p.rides} rides · ${p.validity_days} days · ${inr(p.price_inr)} + GST</div></div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="st-edit-package" data-id="${p.id}">Edit</button></div>`).join('') : '<p class="small muted">No packages yet. Add your first one.</p>'}</section>` : '';
    const hs = `<section class="card"><div class="split"><h2>Horses</h2><button class="btn btn-navy btn-sm" type="button" data-act="st-edit-horse">+ Add horse</button></div>
      ${st.horses.length ? st.horses.map((h) => `<div class="split" style="border-top:1px solid var(--line-2);padding-top:10px">
        <div><b>${esc(h.name)}</b> ${h.active ? '' : '<span class="pill warn">Resting</span>'}<div class="small muted">Up to ${h.daily_limit} sessions a day${h.notes ? ' · ' + esc(h.notes) : ''}</div></div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="st-edit-horse" data-id="${h.id}">Edit</button></div>`).join('') : '<p class="small muted">No horses yet.</p>'}</section>`;
    return `<div class="staff-cols"><div class="main-col">${settingsForm}${hs}</div><div class="side-col">${pk}</div></div>`;
  }

  // ------------------------------------------------------------ sheets
  const head = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-act="close-sheet" aria-label="Close">${icon('close', 20)}</button></div>`;
  function sheet() {
    const sh = S.sheet;
    if (sh.type === 'staff-package') {
      const p = st.packagesAll.find((x) => x.id === sh.id) || { kind: 'polo', name: '', description: '', rides: 1, validity_days: 30, price_inr: 0, active: true, sort: st.packagesAll.length + 1 };
      return `${head(sh.id ? 'Edit package' : 'Add package')}
        <form data-form="st-package"><input type="hidden" name="id" value="${sh.id || ''}">
          <div class="field"><label for="pk-name">Name</label><input id="pk-name" name="name" type="text" maxlength="80" value="${esc(p.name)}" required></div>
          <div class="field"><label for="pk-kind">Discipline (its rides book only these sessions)</label><select id="pk-kind" name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label for="pk-desc">Short description</label><input id="pk-desc" name="description" type="text" maxlength="120" value="${esc(p.description)}"></div>
          <div class="grid3"><div class="field"><label for="pk-rides">Rides</label><input id="pk-rides" name="rides" type="number" min="1" max="1000" value="${p.rides}" required></div>
          <div class="field"><label for="pk-days">Valid (days)</label><input id="pk-days" name="validity_days" type="number" min="1" max="730" value="${p.validity_days}" required></div>
          <div class="field"><label for="pk-sort">Order</label><input id="pk-sort" name="sort" type="number" min="0" max="99" value="${p.sort}"></div></div>
          <div class="field"><label for="pk-price">Price (₹, before GST)</label><input id="pk-price" name="price_inr" type="number" min="0" step="1" value="${p.price_inr}" required></div>
          <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Show to members</label>
          <div class="form-error" hidden></div>
          <button class="btn btn-gold btn-block" type="submit">Save package</button>
          <p class="tiny muted">Changing a package doesn’t change packages members have already bought.</p>
        </form>`;
    }
    if (sh.type === 'staff-horse') {
      const h = st.horses.find((x) => x.id === sh.id) || { name: '', daily_limit: 3, active: true, notes: '' };
      return `${head(sh.id ? 'Edit horse' : 'Add horse')}
        <form data-form="st-horse"><input type="hidden" name="id" value="${sh.id || ''}">
          <div class="field"><label for="hs-name">Name</label><input id="hs-name" name="name" type="text" maxlength="60" value="${esc(h.name)}" required></div>
          <div class="field"><label for="hs-limit">Most sessions per day</label><input id="hs-limit" name="daily_limit" type="number" min="1" max="10" value="${h.daily_limit}" required></div>
          <div class="field"><label for="hs-notes">Notes</label><input id="hs-notes" name="notes" type="text" maxlength="200" value="${esc(h.notes)}" placeholder="e.g. Vet check, no beginners"></div>
          <label class="check"><input type="checkbox" name="active" ${h.active ? 'checked' : ''}> Available for rides</label>
          <div class="form-error" hidden></div>
          <button class="btn btn-gold btn-block" type="submit">Save horse</button>
        </form>`;
    }
    if (sh.type === 'staff-cancel-session') {
      const s = [...st.sessions, ...st.upcoming].find((x) => x.id === sh.id);
      if (!s) return head('Session not found');
      return `${head('Cancel this session?')}
        <div class="summary"><div><span>When</span><b>${esc(fmtShortDay(s.starts_at))}, ${esc(fmtTime(s.starts_at))}</b></div><div><span>Session</span><b>${esc(kindLabel(s.kind))}</b></div></div>
        <p class="muted">Everyone booked gets their ride back. Let them know on WhatsApp.</p>
        <button class="btn btn-danger btn-block" type="button" data-act="st-cancel-session" data-id="${s.id}">Yes, cancel the session</button>
        <button class="btn btn-ghost btn-block" type="button" data-act="close-sheet">Keep it</button>`;
    }
    if (sh.type === 'staff-add-rider') {
      const s = st.sessions.find((x) => x.id === sh.id);
      const taken = new Set(st.bookings.filter((b) => b.session_id === sh.id).map((b) => b.rider_id));
      const opts = st.allRiders.filter((r) => !taken.has(r.id)).map((r) => `<option value="${r.id}">${esc(r.name)} · ${esc(r.profiles?.full_name || '')}</option>`).join('');
      return `${head('Book a rider')}
        <p class="muted small">${s ? `${esc(fmtShortDay(s.starts_at))}, ${esc(fmtTime(s.starts_at))} · ${esc(kindLabel(s.kind))}` : ''}. Uses a ride from the member’s package.</p>
        <form data-form="st-book"><input type="hidden" name="session" value="${sh.id}">
          <div class="field"><label for="br-rider">Rider</label><select id="br-rider" name="rider" required><option value="">Choose a rider…</option>${opts}</select></div>
          <div class="form-error" hidden></div>
          <button class="btn btn-gold btn-block" type="submit">Book</button>
        </form>`;
    }
    return '';
  }

  // ------------------------------------------------------------ actions
  const acts = {
    async 'st-sub'(d) { st.sub = d.sub; ctx.render(); await reload(); },
    async 'st-day'(d) { st.day = Number(d.delta) === 0 ? today() : addDays(st.day, Number(d.delta)); await reload(); },
    async 'st-mark'(d) {
      await api().updateBooking(d.id, { status: d.status });
      const b = st.bookings.find((x) => x.id === d.id); if (b) b.status = d.status;
      ctx.render();
    },
    'st-add-rider'(d) { ctx.openSheet({ type: 'staff-add-rider', id: d.id, title: 'Book a rider' }); },
    'st-ask-cancel-session'(d) { ctx.openSheet({ type: 'staff-cancel-session', id: d.id, title: 'Cancel session', focus: false }); },
    async 'st-cancel-session'(d) { const n = await api().cancelSession(d.id); ctx.closeSheet(); ctx.toast(`Session cancelled. ${n} ride${n === 1 ? '' : 's'} returned.`); await reload(); },
    async 'st-reject'(d) { await api().reject(d.id, 'Payment not received'); ctx.toast('Marked as not received.'); await reload(); },
    async 'st-remove-closure'(d) { await api().removeClosure(d.day); ctx.toast('Day reopened. Add sessions for it under Add sessions.'); await reload(); },
    'st-edit-package'(d) { ctx.openSheet({ type: 'staff-package', id: d.id || null, title: 'Package' }); },
    'st-edit-horse'(d) { ctx.openSheet({ type: 'staff-horse', id: d.id || null, title: 'Horse' }); },
  };
  const forms = {
    async 'st-approve'(v) { await api().approve(v.id, v.start || null); ctx.toast('Package activated. The member can book now.'); await reload(); },
    async 'st-add-membership'(v, f) {
      if (!v.account || !v.package) throw new Error('Choose a member and a package.');
      await api().addMembership(v.account, v.package, v.method, v.ref, v.start || null);
      f.reset(); ctx.toast('Package added to the member.'); await reload();
    },
    async 'st-create'(v, f, fd) {
      const weekdays = fd.getAll('weekday').map(Number);
      const times = [...new Set([...fd.getAll('slot'), v.time].filter(Boolean))];
      if (!weekdays.length) throw new Error('Tick at least one day.');
      if (!times.length) throw new Error('Tick at least one start time.');
      if (v.to < v.from) throw new Error('The end date is before the start date.');
      let n = 0;
      for (const time of times) {
        n += await api().createSessions({
          from: v.from, to: v.to, weekdays, time, kind: v.kind, level: v.level, coach: v.coach,
          capacity: Number(v.capacity), duration: Number(v.duration) || 60,
        });
      }
      ctx.toast(n ? `Created ${n} session${n === 1 ? '' : 's'}.` : 'No new sessions. They already exist or the days are closed.');
      await reload(); await ctx.refreshMember();
    },
    async 'st-closure'(v, f) {
      if (!v.day) throw new Error('Pick a day.');
      const n = await api().addClosure(v.day, v.reason);
      f.reset(); ctx.toast(`Club closed on ${fmtDayFromStr(v.day)}. ${n} booking${n === 1 ? '' : 's'} cancelled and rides returned.`);
      await reload(); await ctx.refreshMember();
    },
    async 'st-settings'(v) {
      const patch = { ...v, cancel_hours: Number(v.cancel_hours) || 0, gst_percent: Number(v.gst_percent) || 0 };
      await api().updateSettings(patch); S.settings = await api().settings();
      ctx.toast('Club details saved.'); ctx.render();
    },
    async 'st-package'(v) {
      if (!v.name?.trim()) throw new Error('Enter a package name.');
      const p = { kind: v.kind || 'polo', name: v.name.trim(), description: (v.description || '').trim(), rides: Number(v.rides), validity_days: Number(v.validity_days), price_inr: Math.round(Number(v.price_inr)), sort: Number(v.sort) || 0, active: v.active === 'on' };
      if (!(p.rides > 0) || !(p.validity_days > 0) || !(p.price_inr >= 0)) throw new Error('Check rides, days and price.');
      if (v.id) p.id = v.id;
      await api().savePackage(p); ctx.closeSheet(); ctx.toast('Package saved.'); await reload(); S.packages = await api().packages();
    },
    async 'st-horse'(v) {
      if (!v.name?.trim()) throw new Error('Enter the horse’s name.');
      const h = { name: v.name.trim(), daily_limit: Number(v.daily_limit) || 3, notes: (v.notes || '').trim(), active: v.active === 'on' };
      if (v.id) h.id = v.id;
      await api().saveHorse(h); ctx.closeSheet(); ctx.toast('Horse saved.'); await reload();
    },
    async 'st-book'(v) {
      if (!v.rider) throw new Error('Choose a rider.');
      try { await api().book(v.session, v.rider); } catch (e) {
        if (e.hint === 'no_rides' || /rides left on a valid/i.test(e.message)) throw new Error('This member has no rides left for that date. Add a package under Payments first.');
        throw e;
      }
      ctx.closeSheet(); ctx.toast('Rider booked.'); await reload();
    },
  };
  const changes = {
    async 'st-date'(el) { if (el.value) { st.day = el.value; await reload(); } },
    async 'st-horse'(el) {
      await api().updateBooking(el.dataset.id, { horse_id: el.value || null });
      const b = st.bookings.find((x) => x.id === el.dataset.id); if (b) b.horse_id = el.value || null;
      ctx.render();
    },
    async 'st-note'(el) {
      await api().updateBooking(el.dataset.id, { coach_note: el.value.trim() });
      const b = st.bookings.find((x) => x.id === el.dataset.id); if (b) b.coach_note = el.value.trim();
      ctx.toast('Note saved.');
    },
    async 'st-role'(el) {
      const m = memberById(el.dataset.id);
      await api().setRole(el.dataset.id, el.value);
      if (m) m.role = el.value;
      ctx.toast(`${m?.full_name || 'Member'} is now ${el.value}.`);
    },
  };
  const inputs = {
    'st-search'(el) { st.q = el.value; const tb = document.getElementById('member-rows'); if (tb) tb.innerHTML = memberRows(); },
  };

  return { render, load, loadBadge, sheet, acts, forms, changes, inputs, badge: () => st.pending.length };
}
