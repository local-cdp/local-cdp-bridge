import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const releaseDir = 'release';
const refName = process.env.GITHUB_REF_NAME ?? `v${process.env.npm_package_version ?? '0.0.0'}`;
const outputName = `local-cdp-bridge-${refName}-checksums.txt`;

const entries = await readdir(releaseDir, { withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => !name.endsWith('-checksums.txt'))
  .sort();

const lines = [];
for (const file of files) {
  const data = await readFile(join(releaseDir, file));
  const hash = createHash('sha256').update(data).digest('hex');
  lines.push(`${hash}  ${file}`);
}

await writeFile(join(releaseDir, outputName), `${lines.join('\n')}\n`, 'utf8');
