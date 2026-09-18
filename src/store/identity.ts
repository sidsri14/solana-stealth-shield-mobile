import * as SecureStore from 'expo-secure-store';
import { generateIdentity, StealthIdentity } from '../crypto/stealth';

const KEY_IDENTITY = 'stealthshield.identity.v1';
const KEY_INDEX = 'stealthshield.index.v1';
const KEY_PAYMENTS = 'stealthshield.payments.v1';

export async function loadIdentity(): Promise<StealthIdentity | null> {
  const raw = await SecureStore.getItemAsync(KEY_IDENTITY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StealthIdentity;
  } catch {
    return null;
  }
}

export async function createIdentity(): Promise<StealthIdentity> {
  const identity = generateIdentity();
  await SecureStore.setItemAsync(KEY_IDENTITY, JSON.stringify(identity));
  return identity;
}

export async function clearIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_IDENTITY);
}

export async function loadScanIndex(): Promise<number> {
  const raw = await SecureStore.getItemAsync(KEY_INDEX);
  return raw ? Number(raw) : 0;
}

export async function bumpScanIndex(): Promise<number> {
  const next = (await loadScanIndex()) + 1;
  await SecureStore.setItemAsync(KEY_INDEX, String(next));
  return next;
}

export interface FoundPayment {
  id: string;
  amountLamports: number;
  amountSol: string;
  stealthAddress: string;
  ephemeralPubkey: string;
  viewTag: number;
  signature: string;
  index: number;
  discoveredAt: number;
  swept: boolean;
}

export async function loadPayments(): Promise<FoundPayment[]> {
  const raw = await SecureStore.getItemAsync(KEY_PAYMENTS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FoundPayment[];
  } catch {
    return [];
  }
}

export async function savePayments(payments: FoundPayment[]): Promise<void> {
  await SecureStore.setItemAsync(KEY_PAYMENTS, JSON.stringify(payments));
}