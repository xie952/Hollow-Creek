import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const chrome = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
await import('node:fs/promises').then(fs => fs.mkdir(resolve('.cache/pw-dof'), { recursive: true }));
const context = await chromium.launchPersistentContext(resolve('.cache/pw-dof'), {
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
await page.evaluate(() => { window.__fade(1); window.__hideUI(true); window.__preset('wide', true); });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({
  focus: window.__post?.bokeh?.uniforms?.focus?.value,
  aperture: window.__post?.bokeh?.uniforms?.aperture?.value,
  maxblur: window.__post?.bokeh?.uniforms?.maxblur?.value,
  near: window.__scene.camera.near, far: window.__scene.camera.far,
  dist: window.__scene.camera.position.distanceTo(window.__scene.controls.target),
}));
console.log('dof-info', JSON.stringify(info));
await page.screenshot({ path: resolve('shots/dof-on.png'), timeout: 240000 });
await page.evaluate(() => window.__quality('low'));
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve('shots/dof-off.png'), timeout: 240000 });
console.log('shots dof-on/off');
if (problems.length) console.log(problems.join('\n')); else console.log('no page errors');
await context.close();
