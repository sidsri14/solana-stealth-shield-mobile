import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { base58ToBytes, bytesToBase58 } from './base58';
import { scanStealthAddress } from './stealth';

const L = 2n ** 252n + 27742317777372353535851937790883648493n;

export function bytesToBig(scalar: Uint8Array): bigint {
  let out = 0n;
  for (let i = scalar.length - 1; i >= 0; i--) out = (out << 8n) | BigInt(scalar[i]);
  return out % L;
}

export function bigToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = value % L;
  for (let i = 0; i < length; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function modL(digest: Uint8Array): bigint {
  let v = 0n;
  for (let i = digest.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(digest[i]);
  return v % L;
}

function hashToScalar(...parts: Uint8Array[]): bigint {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return modL(sha512(buf));
}

export function edwardsScalarFromSecret(seed: Uint8Array): bigint {
  const h = sha512(seed).slice(0, 32);
  const s = new Uint8Array(h);
  s[0] &= 248;
  s[31] &= 127;
  s[31] |= 64;
  return bytesToBig(s);
}

export function deriveSweepKey(
  viewingPrivkeyBase58: string,
  spendingPrivkeyBase58: string,
  ephemeralPubkeyBase58: string,
  viewTag: number,
  index = 0,
): { matched: boolean; stealthAddress?: string; scalarBytes?: Uint8Array } {
  const scan = scanStealthAddress(viewingPrivkeyBase58, spendingPrivkeyBase58, ephemeralPubkeyBase58, viewTag, index);
  if (!scan.matched || !scan.sweepScalarHex) return { matched: false };
  const r = BigInt('0x' + scan.sweepScalarHex) % L;
  const spendScalar = edwardsScalarFromSecret(base58ToBytes(spendingPrivkeyBase58));
  const sweepScalar = (spendScalar + r) % L;
  const pub = ed25519.Point.BASE.multiply(sweepScalar).toBytes();
  return {
    matched: true,
    stealthAddress: bytesToBase58(pub),
    scalarBytes: bigToBytes(sweepScalar, 32),
  };
}

export function signWithScalar(message: Uint8Array, scalar: Uint8Array, pubkey?: Uint8Array): { pubkey: Uint8Array; signature: Uint8Array } {
  const sweepScalar = bytesToBig(scalar);
  const pub = pubkey ?? ed25519.Point.BASE.multiply(sweepScalar).toBytes();
  const prefix = sha512(new Uint8Array([...scalar, ...pub])).slice(0, 32);
  const r = hashToScalar(prefix, message);
  const R = ed25519.Point.BASE.multiply(r).toBytes();
  const k = hashToScalar(R, pub, message);
  const S = (r + k * sweepScalar) % L;
  const signature = new Uint8Array(64);
  signature.set(R, 0);
  signature.set(bigToBytes(S, 32), 32);
  return { pubkey: pub, signature };
}

export function sweepMessageHash(serializedMessage: Uint8Array): Uint8Array {
  return sha256(serializedMessage);
}