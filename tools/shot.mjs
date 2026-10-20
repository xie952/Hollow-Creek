import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:5488/';
const outDir = process.env.SHOT_DIR || 'shots';
const chrome = process.env.CHROME_PATH || 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
const userDataDir = resolve(process.env.PW_PROFILE || '.cache/pw');
const width = Number(process.env.SHOT_W || 1280);
const height = Number(process.env.SHOT_H || 720);
const quality = process.env.SHOT_QUALITY || 'low';
await mkdir(outDir, { recursive: true });
await mkdir(userDataDir, { recursive: true });

// The headless shell with a persistent profile avoids the ProcessSingleton lock
// that the full Chrome binary hits when launched through Playwright on Windows.
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  executablePath: existsSync(chrome) ? chrome : undefined,
  viewport: { width, height },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox',
    '--hide-scrollbars',
  ],
});

const page = context.pages()[0] || await context.newPage();

const problems = [];
page.on('pageerror', (err) => problems.push('PAGEERROR ' + err.message + '\n' + (err.stack || '')));
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    problems.push('CONSOLE ' + msg.type() + ': ' + msg.text());
  }
});

const url = base + (base.includes('?') ? '&' : '?') + 'render=1&quality=' + quality + '&t=24';
console.log('open', url);
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(1200);

const state = await page.evaluate(() => window.__state && window.__state());
console.log('state', JSON.stringify(state));

const shots = (process.env.SHOTS || 'wide,porch,low,detail').split(',').map((s) => s.trim()).filter(Boolean);
for (const name of shots) {
  await page.evaluate((n) => window.__preset(n, true), name);
  await page.waitForTimeout(900);
  const p = join(outDir, 'render-' + name + '.png');
  await page.screenshot({ path: p, timeout: 180000 });
  console.log('shot', p);
}

// A second pass that keeps the overlay visible, for UI review.
if (process.env.SHOT_UI === '1') {
  await page.evaluate(() => window.__hideUI(false));
  await page.evaluate((n) => window.__preset(n, true), 'wide');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(outDir, 'render-ui.png'), timeout: 180000 });
  console.log('shot', join(outDir, 'render-ui.png'));
}

if (problems.length) {
  console.log('--- page problems ---');
  console.log(problems.join('\n'));
} else {
  console.log('no page errors');
}
await context.close();
