// Checks for workflow/renewal-reminders-sms.json.
// Runs the Code node source straight out of the published workflow file, with n8n's globals
// stubbed and the clock frozen, so every branch is exercised without waiting for real days.
//   cd tests && npm install && node renewals.test.js
const path = require('path');
const { DateTime, Settings } = require('luxon');
const wf = require(path.join(__dirname, '..', 'workflow', 'renewal-reminders-sms.json'));
const NODE = { read: 'Read your list', decide: 'Decide what to remind you', done: 'Mark it done', delivered: 'Mark it delivered' };
const src = n => wf.nodes.find(x => x.name === NODE[n]).parameters.jsCode;

function runCode(code, { nodes, executed, state, input }) {
  const $ = name => {
    const has = name in nodes;
    const ex = executed ? executed.includes(name) : has;
    return { isExecuted: ex, first: () => { if (!has) throw new Error('unexecuted ' + name); return nodes[name][0]; }, all: () => nodes[name] || [] };
  };
  const $json = (input && input[0] && input[0].json) || {};
  const fn = new Function('$', '$json', 'DateTime', '$getWorkflowStaticData', '"use strict";\n' + code);
  return fn($, $json, DateTime, () => state);
}
const freeze = iso => { const ms = DateTime.fromISO(iso, { zone: 'America/New_York' }).toMillis(); Settings.now = () => ms; };

const LIST = [
  'Contractor license | 2026-10-22 | every 2 years | renew at the state board site',
  'General liability insurance | 11/21/2026 | yearly | call your agent',
  'Business license | 2027-01-01 | yearly',
  '# a comment line',
  'Truck registration | 2026-09-25 | none',
].join('\n');
const base = {
  business_name: 'Test Plumbing', business_number: '+15551230100', owner_cell: '+15551230199', timezone: 'America/New_York',
  n8n_url: 'https://example.app.n8n.cloud', items: LIST, remind_days: '60, 30, 14, 7, 3, 1, 0', overdue_every_days: 1,
  monthly_outlook: true, outlook_days: 90, done_links: true,
};
function read(settings = {}, tap = null) {
  const nodes = { 'Your settings': [{ json: { ...base, ...settings } }] };
  if (tap) nodes['Done link tapped'] = [{ json: { query: tap } }];
  return runCode(src('read'), { nodes, state: {} })[0].json;
}
function daily(now, state, settings = {}) {
  freeze(now);
  const r = read(settings);
  const nodes = { 'Read your list': [{ json: r }] };
  return runCode(src('decide'), { nodes, state })[0].json;
}
function tap(now, state, query, settings = {}) {
  freeze(now);
  const r = read(settings, query);
  return runCode(src('done'), { nodes: { 'Read your list': [{ json: r }] }, state })[0].json;
}
const delivered = st => runCode(src('delivered'), { nodes: {}, state: st, input: [{ json: { sid: 'SM1' } }] });
const linkOf = (body, key) => { const m = body.match(new RegExp('renewal-done\\?i=' + key + '&n=([a-z0-9]+)')); return m && m[1]; };

let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra, null, 1) : ''); } };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

// ---------- Read your list ----------
t('R1 example numbers refused', throws(() => read({ business_number: '+15555550100' }), /example phone numbers/));
t('R2 done links need a real n8n address', throws(() => read({ n8n_url: 'https://your-instance.app.n8n.cloud' }), /n8n_url/));
t('R2b no address needed when done links are off', read({ n8n_url: '', done_links: false }).cfg.done_links === false);
t('R3 bad time zone refused', throws(() => read({ timezone: 'Nowhere/Land' }), /time zone/));
{
  const r = read({ items: LIST + '\nPermit | 13/45/2026 | yearly\nBond | 2027-03-01 | every fortnight\nBond | 2027-04-01 | 6 months | a | b\n | 2027-01-01 | yearly' });
  const by = k => r.items.find(x => x.key === k);
  t('R4 ISO and US dates read', by('contractor-license').due === '2026-10-22' && by('general-liability-insurance').due === '2026-11-21');
  t('R5 repeats read', JSON.stringify(by('contractor-license').repeat) === '{"years":2}' && JSON.stringify(by('general-liability-insurance').repeat) === '{"years":1}' && by('truck-registration').repeat === null, r.items);
  t('R6 comment ignored, bad date reported, bad repeat reported but kept', r.items.length === 6 && r.problems.some(p => /Permit.*13\/45\/2026/.test(p)) && r.problems.some(p => /every fortnight/.test(p)) && !!by('bond'), r);
  t('R7 same name twice gets its own key, and a note may contain a bar', !!by('bond-2') && by('bond-2').note === 'a | b' && JSON.stringify(by('bond-2').repeat) === '{"months":6}', r.items);
  t('R8 a line with no name is reported', r.problems.some(p => /has no name/.test(p)));
  t('R9 reminder days read, sorted, deduped', JSON.stringify(read({ remind_days: '7, 30,30, x, -1' }).cfg.remind_days) === '[30,7]');
  t('R10 blank reminder days fall back to the default', read({ remind_days: '' }).cfg.remind_days.length === 7);
  t('R11 daily vs tapped', read().mode === 'daily' && read({}, { i: 'x', n: 'y' }).mode === 'tap');
}

// ---------- Daily runs ----------
{
  const st = {};
  let d = daily('2026-09-22T08:00', st);
  t('D1 first run says what it tracks and what is next', d.send && /^Renewal reminders are on for Test Plumbing\. Tracking 4 items\. Next up: Truck registration \(Fri Sep 25, in 3 days\), Contractor license \(Thu Oct 22, in 30 days\), General liability insurance \(Sat Nov 21, in 60 days\)\./.test(d.body), d.body);
  t('D2 first run also sends what is due that day, with done links', /Renewals:\n- Truck registration: due in 3 days \(Fri Sep 25\)\. Done\? https:\/\/example\.app\.n8n\.cloud\/webhook\/renewal-done\?i=truck-registration&n=[a-z0-9]{12}/.test(d.body) && /- Contractor license: due in 30 days \(Thu Oct 22\)\. renew at the state board site\. Done\?/.test(d.body) && /- General liability insurance: due in 60 days/.test(d.body), d.body);
  delivered(st);
  d = daily('2026-09-22T15:00', st);
  t('D3 a second run the same day sends nothing', !d.send && d.reason === 'already ran today');
  d = daily('2026-09-23T08:00', st);
  t('D4 a day with nothing on a reminder day sends nothing', !d.send, d);
  d = daily('2026-09-24T08:00', st);
  t('D5 tomorrow', /Truck registration: due tomorrow \(Fri Sep 25\)/.test(d.body), d.body);
  const n1 = linkOf(d.body, 'truck-registration');
  delivered(st);
  d = daily('2026-09-25T08:00', st);
  t('D6 today, and the same link as before', /Truck registration: due today\./.test(d.body) && linkOf(d.body, 'truck-registration') === n1, d.body);
  delivered(st);
  d = daily('2026-09-26T08:00', st);
  t('D7 overdue every day by default', /Truck registration: 1 day overdue \(was due Fri Sep 25\)/.test(d.body), d.body);
  delivered(st);
  d = daily('2026-09-27T08:00', st);
  t('D8 overdue again the next day', /2 days overdue/.test(d.body), d.body);
  delivered(st);
  d = daily('2026-10-01T08:00', st);
  t('D9 on the 1st: overdue line plus what is coming up, without repeating it', /6 days overdue/.test(d.body) && /Coming up in the next 90 days: Contractor license Thu Oct 22, General liability insurance Sat Nov 21\./.test(d.body) && !/Business license/.test(d.body), d.body);
  delivered(st);
}
{
  const st = {};
  daily('2026-09-22T08:00', st, { overdue_every_days: 7 }); delivered(st);
  let d = daily('2026-09-28T08:00', st, { overdue_every_days: 7 });
  t('D10 overdue every 7 days: not on day 3', !d.send, d);
  d = daily('2026-10-02T08:00', st, { overdue_every_days: 7 });
  t('D11 overdue every 7 days: yes on day 7', /7 days overdue/.test(d.body), d.body);
  const st2 = {};
  daily('2026-09-22T08:00', st2, { overdue_every_days: 0 }); delivered(st2);
  d = daily('2026-09-26T08:00', st2, { overdue_every_days: 0 });
  t('D12 overdue reminders off with 0', !d.send, d);
}
{
  const st = {};
  let d = daily('2026-09-22T08:00', st, { done_links: false, n8n_url: '' });
  t('D13 no links when done links are off', d.send && !/Done\?/.test(d.body), d.body);
  const st2 = {};
  daily('2026-09-22T08:00', st2, { items: 'Permit | 2027-02-30 | yearly' }); delivered(st2);
  d = daily('2026-09-23T08:00', st2, { items: 'Permit | 2027-02-30 | yearly' });
  t('D14 a bad line is reported once, not every day', !d.send, d);
  d = daily('2026-09-24T08:00', st2, { items: 'Permit | 2027-02-31 | yearly' });
  t('D15 and again when it changes', /Check your renewal list:\n- "Permit": I could not read the date "2027-02-31"/.test(d.body), d.body);
  const st3 = {};
  daily('2026-09-22T08:00', st3, { items: 'Permit | 2026-10-01 | yearly' }); delivered(st3);
  d = daily('2026-10-01T08:00', st3, { items: 'Other | 2027-06-01 | yearly' });
  t('D16 on the 1st with nothing close, it says so', /Nothing on your renewal list is due in the next 90 days\./.test(d.body), d.body);
  t('D17 items taken off the list are forgotten', !('permit' in st3.items) && ('other' in st3.items), Object.keys(st3.items));
}
{
  const st = {};
  let d = daily('2026-09-22T08:00', st);
  t('D18 first run produced a text', d.send);
  d = daily('2026-09-24T08:00', st);
  t('D19 Twilio refused yesterday: the old text goes again with the new one', d.body.startsWith('Renewal reminders are on for') && /due tomorrow/.test(d.body), d.body.slice(0, 120));
  delivered(st);
  d = daily('2026-09-25T08:00', st);
  t('D20 after delivery only the new text', !/Renewal reminders are on/.test(d.body) && /due today/.test(d.body), d.body);
  const st2 = {};
  daily('2026-09-22T08:00', st2);
  d = daily('2026-09-26T08:00', st2);
  t('D21 an undelivered text is dropped after 3 days', !/Renewal reminders are on/.test(d.body), d.body.slice(0, 80));
  const many = Array.from({ length: 30 }, (_, i) => 'Certificate number ' + i + ' for the whole crew | 2026-10-22 | yearly | call the office to renew').join('\n');
  d = daily('2026-09-22T08:00', {}, { items: many });
  t('D22 a very long text is cut short under the SMS limit', d.body.length <= 1500 && /\(cut short\)$/.test(d.body), d.body.length);
}

// ---------- Done links ----------
{
  const st = {};
  let d = daily('2026-09-22T08:00', st); delivered(st);
  const nLic = linkOf(d.body, 'contractor-license');
  let r = tap('2026-09-22T12:00', st, { i: 'contractor-license', n: nLic });
  t('T1 done on a 2-year item rolls it forward from its due date', r.ok && r.next === '2028-10-22' && r.first_reminder === '2028-08-23' && /Next due Sunday, October 22, 2028\. The first reminder comes on Wednesday, August 23, 2028\./.test(r.html), r);
  r = tap('2026-09-22T12:01', st, { i: 'contractor-license', n: nLic });
  t('T2 the same link twice changes nothing', !r.ok && /Nothing changed/.test(r.html));
  r = tap('2026-09-22T12:02', st, { i: 'general-liability-insurance', n: 'wrongwrongwr' });
  t('T3 a wrong code changes nothing', !r.ok);
  d = daily('2026-10-22T08:00', st);
  t('T4 the rolled item is not reminded on its old date', !/Contractor license/.test(d.body), d.body);
  const nTruck = linkOf(daily('2026-09-24T08:00', (() => { const s = {}; daily('2026-09-22T08:00', s); delivered(s); return s; })()).body, 'truck-registration');
  t('T5 a link was issued', !!nTruck);
}
{
  const st = {};
  daily('2026-09-22T08:00', st); delivered(st);
  let d = daily('2026-09-24T08:00', st); delivered(st);
  const n = linkOf(d.body, 'truck-registration');
  const r = tap('2026-09-24T09:00', st, { i: 'truck-registration', n });
  t('T6 done on a one-time item stops it', r.ok && r.next === null && /No more reminders for it/.test(r.html), r);
  d = daily('2026-09-25T08:00', st);
  t('T7 no reminder on its due day after done', !/Truck registration/.test(d.body || ''), d.body);
  d = daily('2026-09-26T08:00', st);
  t('T8 and no overdue reminders', !/Truck registration/.test(d.body || ''), d.body);
  d = daily('2026-09-27T08:00', st, { items: LIST.replace('2026-09-25 | none', '2026-09-30 | none') });
  t('T9 giving it a new date in the list brings it back', /Truck registration: due in 3 days/.test(d.body), d.body);
}
{
  const st = {};
  const items = 'Insurance | 2026-10-22 | yearly';
  daily('2026-09-22T08:00', st, { items }); delivered(st);
  const n = linkOf(daily('2026-10-15T08:00', st, { items }).body, 'insurance'); delivered(st);
  tap('2026-10-15T09:00', st, { i: 'insurance', n }, { items });
  t('T10 rolled date stored', st.items.insurance.due === '2027-10-22', st.items);
  let d = daily('2027-09-22T08:00', st, { items });
  t('T11 reminders follow the rolled date, even though the list still has the old one', /Insurance: due in 30 days \(Fri Oct 22\)/.test(d.body), d.body);
  delivered(st);
  d = daily('2027-09-23T08:00', st, { items: 'Insurance | 2027-12-01 | yearly' });
  t('T12 a later date typed into the list wins', !st.items.insurance.due, st.items);
  const st2 = {};
  daily('2026-09-22T08:00', st2, { items }); delivered(st2);
  const n2 = linkOf(daily('2026-10-15T08:00', st2, { items }).body, 'insurance'); delivered(st2);
  tap('2026-10-15T09:00', st2, { i: 'insurance', n: n2 }, { items });
  d = daily('2026-10-16T08:00', st2, { items: 'Insurance | 2026-10-23 | yearly' });
  t('T12b a changed list date wins even when it is earlier than the rolled one', /Insurance: due in 7 days \(Fri Oct 23\)/.test(d.body) && !st2.items.insurance.due, d.body);
  const st3 = {};
  daily('2026-09-22T08:00', st3, { items }); delivered(st3);
  d = daily('2026-10-15T08:00', st3, { items }); delivered(st3);
  const n3 = linkOf(d.body, 'insurance');
  const r = tap('2026-10-15T09:00', st3, { i: 'insurance', n: n3 }, { items });
  const u = (r.html.match(/&amp;u=([a-z0-9]+)/) || [])[1];
  t('T12c the Done page offers an Undo link', !!u && /Tapped this by mistake\? Undo/.test(r.html), r.html);
  const ru = tap('2026-10-15T09:05', st3, { i: 'insurance', u }, { items });
  t('T12d Undo puts it back as it was', ru.ok && ru.undone && /back to due Thursday, October 22, 2026/.test(ru.html) && !st3.items.insurance.due && st3.items.insurance.nonce === n3, ru);
  const ru2 = tap('2026-10-15T09:06', st3, { i: 'insurance', u }, { items });
  t('T12e Undo works once', !ru2.ok);
  d = daily('2026-10-21T08:00', st3, { items });
  t('T12f after Undo the reminders carry on, with the original Done link', /Insurance: due tomorrow/.test(d.body) && linkOf(d.body, 'insurance') === n3, d.body);
}
{
  const st = {};
  const items = 'Filter service | 2026-06-10 | monthly';
  let d = daily('2026-09-22T08:00', st, { items }); delivered(st);
  const n = linkOf(d.body, 'filter-service');
  const r = tap('2026-09-22T09:00', st, { i: 'filter-service', n }, { items });
  t('T14 a long-overdue monthly item rolls to the next date after today', r.next === '2026-10-10', r);
  const r2 = tap('2026-09-22T09:00', {}, { i: 'filter-service', n }, { items });
  t('T15 a link with no memory behind it changes nothing', !r2.ok);
  const st2 = {};
  const evil = 'Tag <script>alert(1)</script> | 2026-09-25 | none';
  d = daily('2026-09-22T08:00', st2, { items: evil });
  const key = Object.keys(st2.items)[0];
  const r3 = tap('2026-09-22T09:00', st2, { i: key, n: linkOf(d.body, key) }, { items: evil });
  t('T16 names are escaped on the page', r3.ok && !/<script>/.test(r3.html) && /&lt;script&gt;/.test(r3.html), r3.html);
}

// ---------- The published file itself ----------
{
  const all = ['read', 'decide', 'done', 'delivered'].map(src).join('\n');
  t('H1 no em or en dashes in code', !new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(all));
  t('H2 ships with no credentials attached', wf.nodes.every(n => !n.credentials));
  const s = Object.fromEntries(wf.nodes.find(n => n.name === 'Your settings').parameters.assignments.assignments.map(a => [a.name, a.value]));
  t('H3 ships with the example numbers and a placeholder n8n address', s.business_number === '+15555550100' && s.owner_cell === '+15555550199' && /your-instance/.test(s.n8n_url));
  const every = wf.nodes.find(n => n.name === 'Every morning at 8').parameters.rule.interval[0];
  t('H4 runs once a day at 8', every.field === 'days' && every.triggerAtHour === 8);
  const hook = wf.nodes.find(n => n.name === 'Done link tapped').parameters;
  t('H5 done links go to renewal-done and answer from the page node', hook.path === 'renewal-done' && hook.responseMode === 'responseNode');
  t('H6 two HTTP Request nodes talk to Twilio, as the sticky says', wf.nodes.filter(n => n.parameters && n.parameters.nodeCredentialType === 'twilioApi').length === 2);
  t('H7 the example numbers are refused', throws(() => { const n = { 'Your settings': [{ json: s }] }; runCode(src('read'), { nodes: n, state: {} }); }, /example phone numbers/));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
