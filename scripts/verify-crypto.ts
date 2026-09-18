import assert from 'node:assert/strict';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToBase58, base58ToBytes } from '../src/crypto/base58';
import { deriveStealthAddress, scanStealthAddress } from '../src/crypto/stealth';
import { deriveSweepKey, signWithScalar, bytesToBig, edwardsScalarFromSecret } from '../src/crypto/sweep';

const L = 2n ** 252n + 27742317777372353535851937790883648493n;
const text = new TextEncoder();

let loop = 0;
while (loop++ < 60) {
  const recipientSpendSeed = ed25519.utils.randomSecretKey();
  const recipientViewKey = ed25519.utils.randomSecretKey();

  const recipientSpendPriv = bytesToBase58(recipientSpendSeed);
  const recipientViewPriv = bytesToBase58(recipientViewKey);
  const recipientSpendPub = bytesToBase58(ed25519.getPublicKey(recipientSpendSeed));
  const recipientViewPub = bytesToBase58(x25519.getPublicKey(recipientViewKey));

  const senderResult = deriveStealthAddress(recipientSpendPub, recipientViewPub, 0);
  const { stealthAddress, ephemeralPubkey, viewTagInt, stealthScalarHex } = senderResult;

  const spendScalar = edwardsScalarFromSecret(recipientSpendSeed);
  const r = BigInt('0x' + stealthScalarHex) % L;
  const algebraScalar = (spendScalar + r) % L;
  const algebraPub = ed25519.Point.BASE.multiply(algebraScalar).toBytes();
  if (bytesToBase58(algebraPub) !== stealthAddress) {
    console.log('MISMATCH');
    console.log('spendScalar (LE hex):', spendScalar.toString(16));
    console.log('edwards getPublicKey match own scalar?', Buffer.from(ed25519.Point.BASE.multiply(spendScalar % L).toBytes()).equals(Buffer.from(ed25519.getPublicKey(recipientSpendSeed))));
    console.log('r == sender result hex back:', r === BigInt('0x' + stealthScalarHex) % L);
    console.log('algebra:', bytesToBase58(algebraPub));
    console.log('sender :', stealthAddress);
    process.exit(1);
  }
  assert.equal(bytesToBase58(algebraPub), stealthAddress, 'r*B + A must equal the derived stealth address');

  const scan = scanStealthAddress(recipientViewPriv, recipientSpendPriv, ephemeralPubkey, viewTagInt, 0);
  assert.ok(scan.matched, 'recipient scan must match');
  assert.equal(scan.sweepScalarHex, stealthScalarHex, 'sweep scalar mismatch');

  const sweep = deriveSweepKey(recipientViewPriv, recipientSpendPriv, ephemeralPubkey, viewTagInt, 0);
  assert.ok(sweep.matched, 'sweep must match');
  assert.equal(sweep.stealthAddress, scan.stealthAddress, 'sweep-key address must own the scanned address');
  assert.equal(bytesToBase58(ed25519.Point.BASE.multiply(bytesToBig(sweep.scalarBytes!)).toBytes()), sweep.stealthAddress, 'scalarBytes must BE a valid key for the sweep address');

  const msg = sha256(text.encode('stealthshield-sweep-test'));
  const { pubkey, signature } = signWithScalar(msg, sweep.scalarBytes!);
  assert.equal(bytesToBase58(pubkey), sweep.stealthAddress, 'signer public key mismatch');
  assert.ok(ed25519.verify(signature, msg, pubkey), 'ed25519 signature must verify');

  const wrongTag = (viewTagInt + 1) % 256;
  assert.equal(scanStealthAddress(recipientViewPriv, recipientSpendPriv, ephemeralPubkey, wrongTag, 0).matched, false, 'bad view tag must not match');
  assert.equal(scanStealthAddress(recipientViewPriv, recipientSpendPriv, ephemeralPubkey, viewTagInt, 1).matched, false, 'wrong index must not match');

  if (scan.stealthAddress === stealthAddress) {
    console.log(`ALL OK (attempt ${loop})`);
    console.log('stealthAddress:', stealthAddress);
    console.log('ephemeralPubkey:', ephemeralPubkey);
    console.log('viewTag:', viewTagInt);
    const b64 = Buffer.from(base58ToBytes(stealthAddress)).toString('base64');
    assert.equal(bytesToBase58(new Uint8Array(Buffer.from(b64, 'base64'))), stealthAddress, 'base64<->base58 round trip');
    console.log('announce blob:', `stealth1:${ephemeralPubkey}:${viewTagInt}:1000000:0`);
    process.exit(0);
  }
}

assert.fail('view tag collided on every attempt');