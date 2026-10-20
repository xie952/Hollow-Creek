import { chromium } from 'playwright';
import { resolve } from 'node:path';
const chrome = 'D:/AI工作区/DSH工作区/browser use/_cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe';
const context = await chromium.launchPersistentContext(resolve('.cache/pw'), { headless: true, executablePath: chrome, viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars'] });
const page = context.pages()[0] || await context.newPage();
await page.goto('http://127.0.0.1:5488/?render=1&quality=low&t=24', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
await page.evaluate(() => window.__preset('wide', true));
await page.waitForTimeout(600);
const out = await page.evaluate(() => {
  const THREE = window.__THREE, { camera, scene } = window.__scene;
  const rc = new THREE.Raycaster();
  const probes = [[490,50],[490,120],[225,80],[590,30],[760,110]];
  const res = [];
  for (const [px,py] of probes) {
    rc.setFromCamera({ x: (px/innerWidth)*2-1, y: -(py/innerHeight)*2+1 }, camera);
    const hits = rc.intersectObjects(scene.children, true).filter(h => h.object.name === 'tree-trunks').slice(0,1);
    if (!hits.length) { res.push({px,py,none:true}); continue; }
    const h = hits[0];
    const m = new THREE.Matrix4(); h.object.getMatrixAt(h.instanceId, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const sc = new THREE.Vector3().setFromMatrixScale(m);
    // canopies near same xz
    let canopy = null;
    scene.traverse(o => { if (o.name === 'tree-canopy') { for (let i=0;i<o.count;i++){ const mm=new THREE.Matrix4(); o.getMatrixAt(i,mm); const q=new THREE.Vector3().setFromMatrixPosition(mm); if (Math.abs(q.x-p.x)<0.2 && Math.abs(q.z-p.z)<0.2) { canopy = { mesh:o.uuid, i, pos:[+q.x.toFixed(2),+q.y.toFixed(2),+q.z.toFixed(2)], visible:o.visible, mat:o.material.type, side:o.material.side, alphaTest:o.material.alphaTest, count:o.count, bbox:o.geometry.boundingSphere?.radius }; } } } });
    res.push({px,py,dist:+h.distance.toFixed(1),trunkPos:[+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)],scale:+sc.x.toFixed(2),canopy});
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await context.close();
