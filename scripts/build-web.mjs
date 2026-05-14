#!/usr/bin/env node
/**
 * Assemble the deployable web bundle for Azure Static Web Apps.
 *
 * Copies into ./web:
 *   - dist/index.js                                       (the connector ESM bundle)
 *   - node_modules/@wacom/signature-sdk/legacy/*.js,wasm  (the biometric SDK)
 *
 * web/capture.html and web/staticwebapp.config.json are committed to the repo.
 *
 * Run after `npm run build`.
 */
import { mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const webDir = resolve(root, 'web');

mkdirSync(webDir, { recursive: true });

function copy(src, dst) {
  const absSrc = resolve(root, src);
  const absDst = resolve(webDir, dst);
  if (!existsSync(absSrc)) {
    console.warn(`[skip] missing source: ${src}`);
    return;
  }
  copyFileSync(absSrc, absDst);
  const sz = statSync(absDst).size;
  console.log(`  ${src.padEnd(60)} -> web/${dst} (${(sz / 1024).toFixed(1)} KB)`);
}

console.log('Assembling web/ bundle for Azure SWA...');
copy('dist/index.js', 'index.js');
copy('node_modules/@wacom/signature-sdk/legacy/signature-sdk.js', 'signature-sdk.js');
copy('node_modules/@wacom/signature-sdk/legacy/signature-sdk.wasm', 'signature-sdk.wasm');
copy('node_modules/@wacom/signature-sdk/legacy/stu-sdk.min.js', 'stu-sdk.min.js');
console.log('Done.');
