import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { PROGRAM_ID } from '../crypto/stealth';

export const DEFAULT_RPC = 'http://127.0.0.1:8899';

export function getConnection(rpc = DEFAULT_RPC): Connection {
  return new Connection(rpc, 'confirmed');
}

export function metaKeyPDA(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('stealth-meta'), owner.toBuffer()],
    new PublicKey(PROGRAM_ID),
  );
  return pda;
}

export interface MetaKeyAccount {
  owner: PublicKey;
  spendingPubkey: Uint8Array;
  viewingPubkey: Uint8Array;
  registeredAt: number;
}

export async function fetchMetaKey(conn: Connection, owner: PublicKey): Promise<MetaKeyAccount | null> {
  const acc = await conn.getAccountInfo(metaKeyPDA(owner));
  if (!acc) return null;
  return {
    owner: new PublicKey(acc.data.subarray(9, 41)),
    spendingPubkey: acc.data.subarray(41, 73).slice(),
    viewingPubkey: acc.data.subarray(73, 105).slice(),
    registeredAt: Number(acc.data.readBigInt64LE(105)),
  };
}

export function buildRegisterMetaKeyIx(payer: PublicKey, spendingPubkey: Uint8Array, viewingPubkey: Uint8Array): Transaction {
  const program = new PublicKey(PROGRAM_ID);
  const meta = metaKeyPDA(payer);
  const disc = sha256(Buffer.from('global:register_meta_key')).subarray(0, 8);
  const data = Buffer.concat([Buffer.from(disc), Buffer.from(spendingPubkey), Buffer.from(viewingPubkey)]);
  const tx = new Transaction().add({
    keys: [
      { pubkey: meta, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: program,
    data,
  });
  return tx;
}

export interface StealthTransfer {
  stealthAddress: string;
  amountLamports: number;
  signature: string;
}

export async function sendToStealthAddress(
  conn: Connection,
  payer: PublicKey,
  stealthAddress: PublicKey,
  amountLamports: number,
  signerSetter: (tx: Transaction) => Promise<Transaction>,
): Promise<StealthTransfer> {
  const createIx = SystemProgram.createAccount({
    fromPubkey: payer,
    newAccountPubkey: stealthAddress,
    lamports: 1,
    space: 0,
    programId: SystemProgram.programId,
  });
  const transferIx = SystemProgram.transfer({ fromPubkey: payer, toPubkey: stealthAddress, lamports: amountLamports });
  const tx = await signerSetter(new Transaction().add(createIx, transferIx));
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, 'confirmed');
  return { stealthAddress: stealthAddress.toString(), amountLamports, signature: sig };
}

export function lamportsForAmount(amountSol: number): number {
  return Math.round(amountSol * 1e9);
}

export interface TransferToAccount {
  signature: string;
  from: string;
  to: string;
  lamports: number;
}

export async function fetchRecentTransfers(conn: Connection, payer: PublicKey, limit = 40): Promise<TransferToAccount[]> {
  const sigs = await conn.getSignaturesForAddress(payer, { limit }, 'confirmed');
  const out: TransferToAccount[] = [];
  for (const sigInfo of sigs) {
    try {
      const tx = await conn.getTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
      if (!tx?.meta) continue;
      const keys = tx.transaction.message.staticAccountKeys;
      for (let i = 0; i < keys.length; i++) {
        const delta = (tx.meta.postBalances[i] ?? 0) - (tx.meta.preBalances[i] ?? 0);
        if (delta <= 0) continue;
        out.push({ signature: sigInfo.signature, from: payer.toString(), to: keys[i].toString(), lamports: delta });
      }
    } catch {
      continue;
    }
  }
  return out.slice(0, limit);
}