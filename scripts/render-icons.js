/** Render favicon.svg into the PWA PNG icon set.
 * Note: the golden hub PNGs under icons/ are the design source of truth
 * (supplied directly). favicon.svg embeds that mark for the browser tab and
 * in-app logo. Re-running this rasterizes from that embed, so only use it if
 * you have re-authored favicon.svg as a fresh vector. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('../tests/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');

async function render(page, size, filename) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
    svg { display: block; width: 100%; height: 100%; }
  </style>${svg}`);
  await page.screenshot({ path: path.join(root, 'icons', filename), omitBackground: true });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await render(page, 192, 'icon-192.png');
  await render(page, 512, 'icon-512.png');
  await render(page, 512, 'icon-maskable-512.png');
  await browser.close();
  console.log('Rendered hub icons: 192px, 512px, maskable 512px');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
