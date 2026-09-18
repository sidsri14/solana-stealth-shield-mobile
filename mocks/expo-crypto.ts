export function getRandomBytes(size: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}