import { copyFile, cp, mkdir } from 'node:fs/promises';

await mkdir('dist/desktop/renderer', { recursive: true });
await cp('src/desktop/renderer', 'dist/desktop/renderer', { recursive: true });
await copyFile('src/desktop/preload.cjs', 'dist/desktop/preload.cjs');
