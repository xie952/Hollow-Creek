import { chromium } from 'playwright';
const exe = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ctx = await chromium.launchPersistentContext('D:/AI工作区/DSH工作区/browser use/forest-cabin/.cache/pw', {
  headless: true,
  executablePath: exe,
  viewport: { width: 1280, height: 720 },
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() !== 'log') console.log('console', m.type(), m.text().slice(0,300)); });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const t0 = Date.now();
await page.goto('http://127.0.0.1:5488/?render=1&quality=low&t=24', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
console.log('ready in', ((Date.now()-t0)/1000).toFixed(1), 's');
await page.waitForTimeout(4000);
console.log('state', JSON.stringify(await page.evaluate(() => window.__state())));
console.log('counts', JSON.stringify(await page.evaluate(() => { let meshes=0, inst=0; window.__scene.scene.traverse(o => { if (o.isInstancedMesh) inst++; else if (o.isMesh) meshes++; }); return { meshes, inst, children: window.__scene.scene.children.length, dof: window.__scene.post.bokeh.enabled, bloom: window.__scene.post.bloom.strength, passes: window.__scene.post.composer.passes.map(p=>p.constructor.name) }; })));
const ts = Date.now();
await page.screenshot({ path: 'shots/first-low.png', timeout: 180000 });
console.log('screenshot in', ((Date.now()-ts)/1000).toFixed(1), 's');
await ctx.close();
