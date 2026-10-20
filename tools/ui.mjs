import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const chrome = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
const out = resolve('shots');
await mkdir(out, { recursive: true });
await mkdir(resolve('.cache/pw-ui'), { recursive: true });
const context = await chromium.launchPersistentContext(resolve('.cache/pw-ui'), {
  headless: true, executablePath: existsSync(chrome) ? chrome : undefined,
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'dark',
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars'],
});
const page = context.pages()[0] || await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE ' + m.text()); });
await page.goto('http://127.0.0.1:5488/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(4000);
await page.evaluate(() => { window.__fade(1); document.body.classList.add('is-ready'); window.__hideUI(false); });
await page.waitForTimeout(2500);
const state = await page.evaluate(() => ({ ready: window.__ready, hidden: document.body.classList.contains('hide-ui'), ui: getComputedStyle(document.getElementById('ui')).opacity, loader: document.getElementById('loader')?.className || 'removed', shots: [...document.querySelectorAll('.shot-btn')].length }));
console.log('ui-state', JSON.stringify(state));
await page.screenshot({ path: resolve('shots/ui.png'), timeout: 240000 });
console.log('shot shots/ui.png');
if (problems.length) console.log(problems.join('\n')); else console.log('no page errors');
await context.close();
