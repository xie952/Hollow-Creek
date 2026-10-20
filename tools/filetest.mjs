import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const chrome = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
await import('node:fs/promises').then(fs => fs.mkdir(resolve('.cache/pw-file'), { recursive: true }));
const context = await chromium.launchPersistentContext(resolve('.cache/pw-file'), {
  headless: true, executablePath: existsSync(chrome) ? chrome : undefined,
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'dark',
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files','--hide-scrollbars'],
});
const page = context.pages()[0] || await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE ' + m.text()); });
const fileUrl = pathToFileURL(resolve('index.html')).href + '?render=1&quality=low&t=24';
console.log('open', fileUrl);
await page.goto(fileUrl, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const state = await page.evaluate(() => window.__state && window.__state());
console.log('file-state', JSON.stringify(state));
await page.screenshot({ path: resolve('shots/file-url.png'), timeout: 240000 });
console.log('shot shots/file-url.png');
if (problems.length) console.log(problems.join('\n')); else console.log('no page errors');
await context.close();
