import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, Transaction, TransactionSignature } from '@solana/web3.js';
import { bytesToBase58 } from '../crypto/base58';

export interface ConnectedWallet {
  address: string;
  label: string;
}

export function base64AddressToBase58(address: string): string {
  const bytes = Buffer.from(address, 'base64');
  return bytesToBase58(new Uint8Array(bytes));
}

export const APP_IDENTITY = {
  name: 'StealthShield Mobile',
  uri: 'https://github.com/sidsri14/solana-stealth-shield-mobile',
  icon: 'https://raw.githubusercontent.com/sidsri14/solana-stealth-shield-mobile/main/assets/icon.png',
};

async function authorizeOnce() {
  return transact(async (wallet) => {
    const auth = await wallet.authorize({ cluster: 'devnet', identity: APP_IDENTITY });
    const address = base64AddressToBase58(auth.accounts[0].address);
    const label = auth.accounts[0].label ?? 'SMS Wallet';
    return { wallet, address, label };
  });
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const { address, label } = await authorizeOnce();
  return { address, label };
}

export async function signAndSend(
  transaction: Transaction,
  feePayer?: string,
): Promise<{ signature: TransactionSignature; address: string }> {
  const { wallet, address } = await authorizeOnce();
  transaction.feePayer = feePayer ? new PublicKey(feePayer) : new PublicKey(address);
  const [signature] = await wallet.signAndSendTransactions({ transactions: [transaction] });
  if (!signature) throw new Error('no signature returned by wallet');
  return { signature, address };
}

export async function signTransaction(transaction: Transaction, feePayer?: string): Promise<Transaction> {
  const { wallet, address } = await authorizeOnce();
  transaction.feePayer = feePayer ? new PublicKey(feePayer) : new PublicKey(address);
  const [signed] = await wallet.signTransactions({ transactions: [transaction] });
  if (!signed) throw new Error('wallet did not sign');
  return signed;
}