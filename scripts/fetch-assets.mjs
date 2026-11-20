// Runs on Vercel at build time: downloads the 3D models listed in assets.json into public/.
// A model that fails to download is skipped; the game falls back to the stand-in figure.
import fs from 'node:fs/promises';
import path from 'node:path';
const list = JSON.parse(await fs.readFile(new URL('../assets.json', import.meta.url), 'utf8'));
for (const a of list) {
  const out = path.join('public', a.file);
  try {
    await fs.mkdir(path.dirname(out), { recursive: true });
    const r = await fetch(a.url); if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer()); await fs.writeFile(out, buf);
    console.log('asset ok', a.file, (buf.length / 1e6).toFixed(1) + ' MB');
  } catch (e) { console.warn('asset skipped', a.file, e.message); }
}
