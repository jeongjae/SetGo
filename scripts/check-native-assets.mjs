// Capacitor serves this directory at its origin root, unlike GitHub Pages /SetGo/.
import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const references = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
  .map(match => match[1])
  .filter(reference => !/^(?:[a-z]+:|\/\/|#)/i.test(reference));
if (!/<script\b[^>]*type=["']module["'][^>]*src=/i.test(html)) {
  throw new Error('Native bundle is missing its JavaScript entry point.');
}
for (const reference of references) {
  const pathname = decodeURIComponent(new URL(reference, 'https://native.invalid/').pathname);
  const file = resolve(root, `.${pathname}`);
  if (!file.startsWith(root + sep)) throw new Error('Asset is outside the native bundle.');
  try {
    if (!statSync(file).isFile()) throw new Error('Not a file');
  } catch {
    throw new Error(`Native asset does not exist: ${reference}. Build with npm run build:native, not the GitHub Pages base path.`);
  }
}
console.log(`Native entry point and ${references.length} local asset references exist at the Capacitor root.`);
