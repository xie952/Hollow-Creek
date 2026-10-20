import { chromium } from 'playwright';
import { resolve } from 'node:path';
const base = 'http://127.0.0.1:5488/';
const chrome = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
const context = await chromium.launchPersistentContext(resolve('.cache/pw'), { headless: true, executablePath: chrome, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars'] });
const page = context.pages()[0] || await context.newPage();
await page.goto(base + '?render=1&quality=low&t=24', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.evaluate(() => window.__preset('wide', true));
await page.waitForTimeout(800);
const out = await page.evaluate(() => {
  const THREE = window.__THREE, { camera, scene } = window.__scene;
  const pts = [[500,555],[620,595],[690,610],[450,530],[380,615],[735,645],[260,655]];
  const rc = new THREE.Raycaster();
  const picks = pts.map(([px,py]) => {
    rc.setFromCamera({ x: (px/innerWidth)*2-1, y: -(py/innerHeight)*2+1 }, camera);
    const hits = rc.intersectObjects(scene.children, true).filter(h => h.object.type !== 'Points').slice(0, 3).map(h => ({
      name: h.object.name, type: h.object.type, dist: +h.distance.toFixed(1),
      color: h.object.material?.color?.getHexString?.(), count: h.object.count
    }));
    return { px, py, hits };
  });
  return picks;
});
console.log(JSON.stringify(out));
await context.close();
