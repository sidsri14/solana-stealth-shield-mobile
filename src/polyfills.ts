import { getRandomValues as expoCryptoGetRandomValues } from 'expo-crypto';
import { Buffer } from 'buffer';

globalThis.Buffer = Buffer;

class Crypto {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T {
    return expoCryptoGetRandomValues(array as Uint8Array) as never;
  }
}

const webCrypto = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : new Crypto();

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, enumerable: true, get: () => webCrypto });
}

const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
if (g.process && !g.process.env) g.process.env = {};