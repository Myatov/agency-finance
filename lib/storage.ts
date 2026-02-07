import path from 'path';
import fs from 'fs/promises';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

export const CONTRACTS_DIR = path.join(UPLOAD_ROOT, 'contracts');
export const CLOSEOUT_DIR = path.join(UPLOAD_ROOT, 'closeout');
export const PERIOD_REPORTS_DIR = path.join(UPLOAD_ROOT, 'period-reports');

export async function ensureUploadDirs(): Promise<void> {
  await fs.mkdir(CONTRACTS_DIR, { recursive: true });
  await fs.mkdir(CLOSEOUT_DIR, { recursive: true });
  await fs.mkdir(PERIOD_REPORTS_DIR, { recursive: true });
}

export function contractFilePath(relativePath: string): string {
  return path.join(CONTRACTS_DIR, relativePath);
}

export function closeoutFilePath(relativePath: string): string {
  return path.join(CLOSEOUT_DIR, relativePath);
}

/** Сохраняет файл в папку договоров. Возвращает относительный путь для БД. */
export async function saveContractFile(
  buffer: Buffer,
  clientId: string,
  originalName: string
): Promise<string> {
  await ensureUploadDirs();
  const ext = path.extname(originalName) || '';
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${clientId}_${Date.now()}_${base}${ext}`;
  const relativePath = filename;
  const fullPath = path.join(CONTRACTS_DIR, relativePath);
  await fs.writeFile(fullPath, buffer);
  return relativePath;
}

/** Сохраняет файл в папку закрывающих. Возвращает относительный путь для БД. */
export async function saveCloseoutFile(
  buffer: Buffer,
  clientId: string,
  originalName: string
): Promise<string> {
  await ensureUploadDirs();
  const ext = path.extname(originalName) || '';
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${clientId}_${Date.now()}_${base}${ext}`;
  const relativePath = filename;
  const fullPath = path.join(CLOSEOUT_DIR, relativePath);
  await fs.writeFile(fullPath, buffer);
  return relativePath;
}

export async function deleteContractFile(relativePath: string): Promise<void> {
  const fullPath = path.join(CONTRACTS_DIR, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }
}

export async function deleteCloseoutFile(relativePath: string): Promise<void> {
  const fullPath = path.join(CLOSEOUT_DIR, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }
}

export function periodReportFilePath(relativePath: string): string {
  return path.join(PERIOD_REPORTS_DIR, relativePath);
}

export async function savePeriodReportFile(
  buffer: Buffer,
  workPeriodId: string,
  originalName: string
): Promise<string> {
  await ensureUploadDirs();
  const ext = path.extname(originalName) || '';
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${workPeriodId}_${Date.now()}_${base}${ext}`;
  const relativePath = filename;
  const fullPath = path.join(PERIOD_REPORTS_DIR, relativePath);
  await fs.writeFile(fullPath, buffer);
  return relativePath;
}

export async function deletePeriodReportFile(relativePath: string): Promise<void> {
  const fullPath = path.join(PERIOD_REPORTS_DIR, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }
}
