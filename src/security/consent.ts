import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { appDataDir } from '../system/paths.js';

export const TERMS_VERSION = '2026-05-07';

export interface ConsentRecord {
  termsVersion: string;
  acceptedAt: string;
  appVersion: string;
}

export function consentFile(): string {
  return join(appDataDir(), 'consent.json');
}

export async function readConsent(): Promise<ConsentRecord | null> {
  try {
    return JSON.parse(await readFile(consentFile(), 'utf8')) as ConsentRecord;
  } catch {
    return null;
  }
}

export async function hasCurrentConsent(): Promise<boolean> {
  const record = await readConsent();
  return record?.termsVersion === TERMS_VERSION;
}

export async function acceptConsent(appVersion: string): Promise<ConsentRecord> {
  const record: ConsentRecord = {
    termsVersion: TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
    appVersion
  };
  const file = consentFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}
