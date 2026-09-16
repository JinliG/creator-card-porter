// Screenshot the demo animation at key timestamps for visual verification.
// Usage: NODE_PATH=$(npm root -g) node demo/_shots.mjs
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = await import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);

const DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML = 'file://' + path.join(DIR, 'Creator Card Porter Demo.html');
const OUT = path.join(DIR, '_shots');
const TIMES = [12.55, 13.0, 13.6];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.error('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

fs.mkdirSync(OUT, { recursive: true });

// warmup for fonts
await page.goto(HTML, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
const t0 = Date.now();

for (const target of TIMES) {
  const wait = t0 + target * 1000 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  const file = path.join(OUT, `t${target.toFixed(1)}.png`);
  await page.screenshot({ path: file });
  console.log('shot', file);
}
await browser.close();
