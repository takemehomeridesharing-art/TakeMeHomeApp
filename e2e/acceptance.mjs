/**
 * The README acceptance walkthrough, driven through the real UIs with Playwright:
 * a new passenger on the mobile web preview, Claudine on the web preview, and the admin dashboard.
 *
 *   pnpm db:reset && pnpm dev        # in one terminal (API :4000, admin :5173, Expo :8081)
 *   pnpm e2e                         # in another
 *
 * Needs a Chromium: `pnpm exec playwright-core install chromium` once, or set CHROME_PATH.
 * Env: APP_URL (default http://localhost:8081), ADMIN_URL (http://localhost:5173), SHOTS_DIR.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR ?? path.join(os.tmpdir(), 'tmh-acceptance');
// A fresh number each run so the walkthrough always signs up a new account.
const PHONE = process.argv[2] ?? `78${String(Date.now()).slice(-7)}`;
const NAME = `Amani Keza ${PHONE.slice(-3)}`;
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
async function ctx(viewport) {
  const c = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await c.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  p.on('dialog', (d) => d.accept());
  return p;
}
const tid = (p, id) => p.locator(`[data-testid="${id}"]`);
let n = 0;
const shot = async (p, name) => {
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, '0')}-${name}.png` });
};
const step = (s) => console.log(`\n▶ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);

async function appLogin(p, phone) {
  await p.goto(APP);
  await tid(p, 'get-started').click({ timeout: 30000 });
  await tid(p, 'phone-input').fill(phone);
  await tid(p, 'send-code').click();
  await p.waitForTimeout(1200);
  await p.keyboard.type('123456');
  await p.waitForTimeout(2500);
}

// 2. Sign up a new passenger
step('2. Phone: sign up with a new number, OTP 123456, profile');
const P = await ctx({ width: 390, height: 844 });
await appLogin(P, PHONE);
await tid(P, 'name-input').fill(NAME);
const contact = P.locator('input[placeholder="788 123 456"]');
if (await contact.count()) await contact.last().fill('788999888');
await tid(P, 'profile-continue').click();
await P.waitForURL(/\/home/, { timeout: 15000 });
await shot(P, 'passenger-home');
ok('signed up and landed on Home');

// 3. Search Kimisagara → CBD tomorrow
step('3. Rides: Kimisagara → CBD, tomorrow');
await P.goto(`${APP}/rides`);
await tid(P, 'search-from').click({ timeout: 15000 });
await tid(P, 'place-kimisagara').click();
await tid(P, 'search-to').click();
await tid(P, 'place-cbd').click();
await tid(P, 'result-0').waitFor({ timeout: 15000 });
const first = await tid(P, 'result-0').innerText();
console.log('  top result:', first.replace(/\s+/g, ' ').slice(0, 160));
if (!/Claudine/.test(first) || !/610/.test(first)) throw new Error('Claudine RWF 610 not top result');
await shot(P, 'search-results');
ok('Claudine’s Nyamirambo → CBD trip is the top match at RWF 610');

// 4. Move the drop-off and watch the price change
step('4. Trip detail: move drop-off to Nyabugogo and back');
await tid(P, 'result-0').click();
const cta = tid(P, 'request-to-join');
await cta.waitFor({ timeout: 15000 });
console.log('  CTA:', await cta.innerText());
await P.getByRole('button', { name: /^Nyabugogo/ }).click();
await P.waitForTimeout(600);
const ctaNyab = await cta.innerText();
console.log('  CTA after Nyabugogo:', ctaNyab);
if (!/420/.test(ctaNyab)) throw new Error('price did not change to 420');
await shot(P, 'trip-nyabugogo');
await P.getByRole('button', { name: /^CBD/ }).click();
await P.waitForTimeout(600);
const ctaCbd = await cta.innerText();
if (!/610/.test(ctaCbd)) throw new Error('price did not return to 610');
ok(`price recomputes live: Nyabugogo → ${ctaNyab.match(/RWF [\d,]+/)?.[0]}, CBD → ${ctaCbd.match(/RWF [\d,]+/)?.[0]}`);

// 5. Request to join
step('5. Request to join');
await cta.click();
await P.waitForURL(/\/request\//, { timeout: 15000 });
await tid(P, 'request-status-pending').waitFor({ timeout: 10000 });
await shot(P, 'request-pending');
ok('request pending — waiting for Claudine');

// 6. Claudine on the web preview sees it in realtime and accepts
step('6. Web: Claudine sees the request in realtime and accepts');
const D = await ctx({ width: 1280, height: 800 });
await appLogin(D, '788000002');
await D.waitForURL(/\/my-trip/, { timeout: 15000 }); // drivers land on My Trip
const card = D.locator('[data-testid^="join-request-"]', { hasText: NAME });
await card.waitFor({ timeout: 20000 });
await shot(D, 'driver-request-arrived');
const acceptBtn = card.locator('[data-testid^="accept-"]');
await acceptBtn.click();
ok('request visible on My Trip and accepted');

// 7. Phone: accepted in realtime → MoMo → ticket
step('7. Phone: accepted in realtime → pay with MoMo → approve → ticket');
await tid(P, 'request-status-accepted').waitFor({ timeout: 15000 });
await shot(P, 'request-accepted');
ok('request flipped to Accepted without reload');
await tid(P, 'pay-momo').click();
await tid(P, 'pay-with-momo').click({ timeout: 15000 });
await tid(P, 'momo-waiting').waitFor({ timeout: 10000 });
await tid(P, 'momo-approve').click({ timeout: 15000 });
await shot(P, 'momo-approved');
await P.waitForURL(/\/booking\//, { timeout: 20000 });
await P.waitForTimeout(1500);
const ticket = await P.locator('body').innerText();
const code = ticket.match(/TMH-[A-Z0-9]{4}/)?.[0];
if (!code) throw new Error('no trip code on ticket');
if (!/Guaranteed Ride Home/.test(ticket)) throw new Error('no Guaranteed Ride Home note');
await shot(P, 'ticket');
ok(`ticket ${code} with Guaranteed Ride Home`);

// 8. Track → SOS
step('8. Track → SOS');
await tid(P, 'track-trip').click();
await P.waitForURL(/\/track\//);
await tid(P, 'sos-button').click({ timeout: 15000 });
await tid(P, 'sos-confirm').click();
await tid(P, 'sos-sent').waitFor({ timeout: 10000 });
console.log('  SOS:', (await tid(P, 'sos-sent-detail').innerText()).replace(/\s+/g, ' '));
await shot(P, 'sos-sent');
ok('SOS sent');

// 9. Claudine starts and completes the trip
step('9. Web: Claudine starts → completes the trip');
await D.goto(`${APP}/my-trip`);
await tid(D, 'start-trip').click({ timeout: 15000 });
await tid(D, 'start-sheet-confirm').click();
await tid(D, 'complete-trip').click({ timeout: 15000 });
await tid(D, 'complete-sheet-confirm').click();
await D.waitForURL(/\/trip\//, { timeout: 15000 });
await D.waitForTimeout(1500);
const ledger = (await D.locator('[data-testid="driver-trip-view"] [data-testid="ledger-card"]').innerText()).replace(/\s+/g, ' ');
console.log('  ledger:', ledger.slice(0, 200));
await shot(D, 'driver-completed');
ok('trip completed');

// 10. Both sides rate
step('10. Both sides rate each other');
const bookingUrl = P.url().replace(/\/track\//, '/booking/');
await P.goto(bookingUrl);
await tid(P, 'rate-trip').click({ timeout: 20000 });
await P.getByRole('button', { name: '5 stars' }).click();
await P.getByText('Punctual', { exact: true }).click();
await P.getByText('Safe driving', { exact: true }).click();
await tid(P, 'rate-submit').click();
await tid(P, 'rate-success').waitFor({ timeout: 10000 });
ok('passenger rated driver');
const rateBtn = D.locator('[data-testid^="passenger-"]', { hasText: NAME }).locator('[data-testid^="rate-"]');
await rateBtn.click({ timeout: 15000 });
await D.getByRole('button', { name: '4 stars' }).click();
await D.getByText('Friendly', { exact: true }).click();
await tid(D, 'rate-submit').click();
await tid(D, 'rate-success').waitFor({ timeout: 10000 });
await shot(D, 'driver-rated');
ok('driver rated passenger');

// 11. Admin sees everything
step('11. Admin dashboard');
const A = await ctx({ width: 1440, height: 900 });
await A.goto(ADMIN);
await A.locator('input[type="tel"]').fill('0788000001');
await A.locator('button[type="submit"]').click();
await A.locator('input[placeholder="••••••"]').fill('123456');
await A.locator('button[type="submit"]').click();
await A.getByText('Overview').first().waitFor({ timeout: 15000 });
await A.waitForTimeout(1500);
await shot(A, 'admin-overview');
for (const [hash, needle] of [
  ['users', NAME],
  ['trips', 'Claudine'],
  ['bookings', code],
  ['payments', code],
  ['ratings', code],
  ['safety', code],
]) {
  await A.goto(`${ADMIN}/#/${hash}`);
  await A.getByText(needle).first().waitFor({ timeout: 15000 });
  await shot(A, `admin-${hash}`);
  ok(`admin ${hash} shows ${needle}`);
}

// 12. Suspend the passenger; their next request is blocked
step('12. Suspend the passenger → next request blocked');
await A.goto(`${ADMIN}/#/users`);
const row = A.locator('tr', { hasText: NAME });
await row.getByRole('button', { name: 'Suspend' }).click();
await row.getByText(/suspended/i).first().waitFor({ timeout: 10000 });
ok('suspended in admin');
await P.goto(`${APP}/rides`);
await tid(P, 'search-from').click({ timeout: 15000 });
await tid(P, 'place-cbd').click();
await tid(P, 'search-to').click();
await tid(P, 'place-nyamirambo').click();
await tid(P, 'result-0').click({ timeout: 15000 });
await tid(P, 'request-to-join').click({ timeout: 15000 });
await tid(P, 'join-error').waitFor({ timeout: 10000 });
const err = (await tid(P, 'join-error').innerText()).replace(/\s+/g, ' ');
console.log('  error:', err);
if (!/suspended/i.test(err)) throw new Error('suspension error not shown');
await shot(P, 'suspended-error');
ok('suspended passenger sees a clear error');

console.log(`\n✅ Acceptance walkthrough passed — screenshots in ${SHOTS}`);
await browser.close();
