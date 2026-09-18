import * as Crypto from 'expo-crypto';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToBase58, base58ToBytes, bytesToHex } from './base58';

export interface StealthIdentity {
  spendingPubkey: string;
  spendingPrivkey: string;
  viewingPubkey: string;
  viewingPrivkey: string;
  metaAddress: string;
  createdAt: number;
}

export interface DeriveResult {
  stealthAddress: string;
  ephemeralPubkey: string;
  viewTag: string;
  viewTagInt: number;
  stealthScalarHex: string;
  canSweep: boolean;
}

function randomBytes(length: number): Uint8Array {
  return Crypto.getRandomBytes(length);
}

const L = 2n ** 252n + 27742317777372353535851937790883648493n;

function viewTag(sharedSecret: Uint8Array, index: number): number {
  return sha256(new Uint8Array([...sharedSecret, index]))[0];
}

function scalarFromBytes(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = 31; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]);
  return value % L;
}

export function generateIdentity(): StealthIdentity {
  const spendPriv = randomBytes(32);
  const spendPub = ed25519.getPublicKey(spendPriv);
  const viewPriv = randomBytes(32);
  const viewPub = x25519.getPublicKey(viewPriv);
  return {
    spendingPubkey: bytesToBase58(spendPub),
    spendingPrivkey: bytesToBase58(spendPriv),
    viewingPubkey: bytesToBase58(viewPub),
    viewingPrivkey: bytesToBase58(viewPriv),
    metaAddress: `st:sol:${bytesToBase58(spendPub).slice(0, 10)}...${bytesToBase58(viewPub).slice(0, 10)}`,
    createdAt: Date.now(),
  };
}

export function deriveStealthAddress(
  spendingPubkeyBase58: string,
  viewingPubkeyBase58: string,
  index = 0,
): DeriveResult {
  const ephemeralPriv = randomBytes(32);
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  const shared = x25519.getSharedSecret(ephemeralPriv, base58ToBytes(viewingPubkeyBase58));
  const tag = viewTag(shared, index);
  const r = scalarFromBytes(sha256(new Uint8Array([...shared, index])));
  const spendPub = ed25519.Point.fromBytes(base58ToBytes(spendingPubkeyBase58));
  const stealthPoint = ed25519.Point.BASE.multiply(r).add(spendPub);
  const stealthPub = stealthPoint.toBytes();
  return {
    stealthAddress: bytesToBase58(stealthPub),
    ephemeralPubkey: bytesToBase58(ephemeralPub),
    viewTag: '0x' + tag.toString(16).toUpperCase().padStart(2, '0'),
    viewTagInt: tag,
    stealthScalarHex: r.toString(16).padStart(64, '0'),
    canSweep: false,
  };
}

export function scanStealthAddress(
  viewingPrivkeyBase58: string,
  spendingPrivkeyBase58: string,
  ephemeralPubkeyBase58: string,
  expectedViewTag: number,
  index = 0,
): { matched: boolean; stealthAddress?: string; sweepScalarHex?: string } {
  const shared = x25519.getSharedSecret(base58ToBytes(viewingPrivkeyBase58), base58ToBytes(ephemeralPubkeyBase58));
  const tag = viewTag(shared, index);
  if (tag !== expectedViewTag) return { matched: false };
  const r = scalarFromBytes(sha256(new Uint8Array([...shared, index])));
  const spendPub = ed25519.getPublicKey(base58ToBytes(spendingPrivkeyBase58));
  const stealthPoint = ed25519.Point.BASE.multiply(r).add(ed25519.Point.fromBytes(spendPub));
  return {
    matched: true,
    stealthAddress: bytesToBase58(stealthPoint.toBytes()),
    sweepScalarHex: r.toString(16).padStart(64, '0'),
  };
}

export function stealthMetaAddress(spendingPubkeyBase58: string, viewingPubkeyBase58: string): string {
  return `st:sol:${spendingPubkeyBase58.slice(0, 10)}...${viewingPubkeyBase58.slice(0, 10)}`;
}

export { bytesToBase58, bytesToHex };

export const PROGRAM_ID = '4H4HkWERVP3TsVYqSKcUcrdg8tCGeYaV7wj9WjMsjspD';