const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);

function gfMultiply(a, b) {
  let result = 0;
  for (let i = 0; i < 8; i += 1) {
    if (b & 1) result ^= a;
    const high = a & 0x80;
    a = (a << 1) & 0xff;
    if (high) a ^= 0x1b;
    b >>= 1;
  }
  return result;
}

function rotateByte(value, amount) {
  return ((value << amount) | (value >>> (8 - amount))) & 0xff;
}

for (let value = 0; value < 256; value += 1) {
  let inverse = 0;
  if (value !== 0) {
    inverse = 1;
    let power = 254;
    let base = value;
    while (power > 0) {
      if (power & 1) inverse = gfMultiply(inverse, base);
      base = gfMultiply(base, base);
      power >>= 1;
    }
  }
  const substituted = inverse ^ rotateByte(inverse, 1) ^ rotateByte(inverse, 2) ^ rotateByte(inverse, 3) ^ rotateByte(inverse, 4) ^ 0x63;
  SBOX[value] = substituted;
  INV_SBOX[substituted] = value;
}

export const KEY_SIZES = { 128: 16, 192: 24, 256: 32 };
export const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
export const fromHex = (hex) => {
  const normalized = hex.trim().replace(/\s+/g, '');
  if (!normalized || normalized.length % 2 || !/^[\da-f]+$/i.test(normalized)) throw new Error('Masukkan Hex valid dengan jumlah digit genap.');
  return Uint8Array.from(normalized.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
};
export const toBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
export const fromBase64 = (value) => {
  try { return Uint8Array.from(atob(value.trim()), (char) => char.charCodeAt(0)); }
  catch { throw new Error('Masukkan Base64 valid.'); }
};

export function expandKey(key) {
  const nk = key.length / 4;
  if (![4, 6, 8].includes(nk)) throw new Error('Kunci harus 16, 24, atau 32 byte.');
  const rounds = nk + 6;
  const words = Array.from({ length: 4 * (rounds + 1) }, (_, index) => index < nk ? Array.from(key.subarray(index * 4, index * 4 + 4)) : null);
  let rcon = 1;
  for (let i = nk; i < words.length; i += 1) {
    let temp = [...words[i - 1]];
    if (i % nk === 0) {
      temp = [SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]], SBOX[temp[0]]];
      temp[0] ^= rcon;
      rcon = gfMultiply(rcon, 2);
    } else if (nk > 6 && i % nk === 4) temp = temp.map((byte) => SBOX[byte]);
    words[i] = words[i - nk].map((byte, j) => byte ^ temp[j]);
  }
  return Array.from({ length: rounds + 1 }, (_, round) => Uint8Array.from(words.slice(round * 4, round * 4 + 4).flat()));
}

const addRoundKey = (state, key) => state.map((byte, index) => byte ^ key[index]);
const subBytes = (state) => state.map((byte) => SBOX[byte]);
const shiftRows = (state) => {
  const result = new Uint8Array(16);
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) result[col * 4 + row] = state[((col + row) % 4) * 4 + row];
  return result;
};
const mixColumns = (state) => {
  const result = new Uint8Array(16);
  for (let col = 0; col < 4; col += 1) {
    const i = col * 4;
    const [a, b, c, d] = state.subarray(i, i + 4);
    result[i] = gfMultiply(a, 2) ^ gfMultiply(b, 3) ^ c ^ d;
    result[i + 1] = a ^ gfMultiply(b, 2) ^ gfMultiply(c, 3) ^ d;
    result[i + 2] = a ^ b ^ gfMultiply(c, 2) ^ gfMultiply(d, 3);
    result[i + 3] = gfMultiply(a, 3) ^ b ^ c ^ gfMultiply(d, 2);
  }
  return result;
};

export function simulateBlock(block, key) {
  const roundKeys = expandKey(key);
  const rounds = roundKeys.length - 1;
  let state = new Uint8Array(16);
  state.set(block.subarray(0, 16));
  const stages = [{ label: 'State awal', round: 0, operation: 'Plaintext', state: new Uint8Array(state) }];
  state = addRoundKey(state, roundKeys[0]);
  stages.push({ label: 'AddRoundKey', round: 0, operation: 'Kunci awal', state: new Uint8Array(state) });
  for (let round = 1; round <= rounds; round += 1) {
    state = subBytes(state);
    stages.push({ label: 'SubBytes', round, operation: 'Substitusi byte', state: new Uint8Array(state) });
    state = shiftRows(state);
    stages.push({ label: 'ShiftRows', round, operation: 'Pergeseran baris', state: new Uint8Array(state) });
    if (round !== rounds) {
      state = mixColumns(state);
      stages.push({ label: 'MixColumns', round, operation: 'Pencampuran kolom', state: new Uint8Array(state) });
    }
    state = addRoundKey(state, roundKeys[round]);
    stages.push({ label: 'AddRoundKey', round, operation: 'Penambahan kunci putaran', state: new Uint8Array(state) });
  }
  return stages;
}
