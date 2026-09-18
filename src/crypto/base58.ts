const BASE58_ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function bytesToBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let zeros = 0;
  for (const byte of bytes) {
    if (byte === 0) zeros++;
    else break;
  }
  let out = '';
  for (let i = 0; i < zeros; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPH[digits[i]];
  return out;
}

export function base58ToBytes(input: string): Uint8Array {
  let bytes = 0n;
  for (const char of input) {
    const value = BASE58_ALPH.indexOf(char);
    if (value === -1) throw new Error(`invalid base58 char: ${char}`);
    bytes = bytes * 58n + BigInt(value);
  }
  const decoded: number[] = [];
  while (bytes > 0n) {
    decoded.unshift(Number(bytes & 0xffn));
    bytes >>= 8n;
  }
  let leading = 0;
  for (const char of input) {
    if (char === '1') leading++;
    else break;
  }
  const out = new Uint8Array(decoded.length + leading);
  out.set(new Uint8Array(decoded), leading);
  return out;
}

const HEX = (bytes: Uint8Array): string => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

export { HEX as bytesToHex };