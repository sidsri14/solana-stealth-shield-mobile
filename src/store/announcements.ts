import * as SecureStore from 'expo-secure-store';
import { base58ToBytes } from '../crypto/base58';

const KEY_ANNOUNCEMENTS = 'stealthshield.announcements.v1';

export const ANNOUNCE_PREFIX = 'stealth1:';

export interface Announcement {
  id: string;
  ephemeralPubkey: string;
  viewTag: number;
  amountLamports: number;
  index: number;
  createdAt: number;
  note?: string;
  signature?: string;
  from?: string;
  swept?: boolean;
  sweepSignature?: string;
}

export async function loadAnnouncements(): Promise<Announcement[]> {
  const raw = await SecureStore.getItemAsync(KEY_ANNOUNCEMENTS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Announcement[];
  } catch {
    return [];
  }
}

export async function markAnnouncementSwept(id: string, sweepSignature: string): Promise<Announcement[]> {
  const all = await loadAnnouncements();
  const next = all.map((a) => (a.id === id ? { ...a, swept: true, sweepSignature } : a));
  await SecureStore.setItemAsync(KEY_ANNOUNCEMENTS, JSON.stringify(next));
  return next;
}

export async function appendAnnouncement(a: Announcement): Promise<Announcement[]> {
  const all = await loadAnnouncements();
  all.push(a);
  await SecureStore.setItemAsync(KEY_ANNOUNCEMENTS, JSON.stringify(all));
  return all;
}

export async function addImportedAnnouncement(blob: string, signature?: string): Promise<Announcement> {
  const a = parseAnnouncementBlob(blob);
  if (signature) a.signature = signature;
  return (await appendAnnouncement(a)).slice(-1)[0];
}

export function announceBlob(a: Pick<Announcement, 'ephemeralPubkey' | 'viewTag' | 'amountLamports' | 'index'>): string {
  return [ANNOUNCE_PREFIX, a.ephemeralPubkey, a.viewTag, a.amountLamports, a.index].join(':');
}

export function parseAnnouncementBlob(blob: string): Announcement {
  const clean = blob.trim();
  const parts = clean.split(':');
  if (parts.length < 4) throw new Error('invalid announcement blob');
  const [ephemeralPubkey, viewTag, amountLamports] = parts.slice(1);
  const index = Number(parts[parts.length - 1]);
  base58ToBytes(ephemeralPubkey);
  return {
    id: `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ephemeralPubkey,
    viewTag: Number(viewTag),
    amountLamports: Number(amountLamports),
    index: Number.isFinite(index) ? index : 0,
    createdAt: Date.now(),
  };
}

export function solFromLamports(lamports: number): string {
  return lamports.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function lamportsFromSol(sol: string): number {
  const n = Number(sol);
  if (!Number.isFinite(n) || n <= 0) throw new Error('enter a valid amount');
  return Math.round(n * 1e9);
}