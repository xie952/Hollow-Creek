import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = 'http://127.0.0.1:5488/';
const chrome = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
await mkdir('shots/iso', { recursive: true });
const context = await chromium.launchPersistentContext(resolve('.cache/pw'), { headless: true, executablePath: chrome, viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars'] });
const page = context.pages()[0] || await context.newPage();
await page.goto(base + '?render=1&quality=low&t=24', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.evaluate(() => window.__preset('wide', true));
await page.waitForTimeout(700);
const names = await page.evaluate(() => {
  const out = [];
  window.__scene.scene.traverse(o => { if (o.name && o.visible) out.push(o.name); });
  return [...new Set(out)];
});
console.log('objects', names.join(','));
async function grab(tag, hideNames) {
  const data = await page.evaluate(async (hideNames) => {
    const { scene, post, renderer } = window.__scene;
    const toggled = [];
    scene.traverse(o => {
      if (hideNames.includes(o.name) && o.visible) { o.visible = false; toggled.push(o); }
    });
    post.setSize(960, 540);
    post.render(0.016);
    const url = renderer.domElement.toDataURL('image/png');
    toggled.forEach(o => o.visible = true);
    return url;
  }, hideNames);
  await writeFile('shots/iso/' + tag + '.png', Buffer.from(data.split(',')[1], 'base64'));
  console.log('grab', tag);
}
await grab('all', []);
await grab('no-trunks', ['tree-trunks']);
await grab('no-canopy', ['tree-canopy']);
await grab('no-firs', ['distant-firs']);
await context.close();
