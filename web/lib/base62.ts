const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const NOUNS = [
  'panda', 'eagle', 'tiger', 'shark', 'falcon', 'whale', 'otter', 'deer',
  'fox', 'wolf', 'raven', 'bear', 'lynx', 'stag', 'elk', 'hare',
  'seal', 'hawk', 'owl', 'dove', 'swan', 'mule', 'gecko', 'newt',
  'moose', 'emu', 'ibis', 'kite', 'lark', 'oryx', 'puma',
  'quail', 'roach', 'skua', 'tern', 'uakari', 'vole', 'wren', 'yak',
  'zebra', 'albatross', 'badger', 'coral', 'dolphin', 'ferret',
];

/** Uniform integer in [0, max) from a CSPRNG (rejection sampling, no modulo bias). */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** noun + 4 digits: ~450,000 codes, e.g. "otter0427". */
export function generateMemorable(): string {
  const noun = NOUNS[randomInt(NOUNS.length)];
  const num = randomInt(10000).toString().padStart(4, '0');
  return `${noun}${num}`;
}

export function generateBase62(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET[randomInt(ALPHABET.length)];
  }
  return result;
}

export function isValidBase62(code: string): boolean {
  return /^[0-9A-Za-z]+$/.test(code) && code.length > 0 && code.length <= 20;
}
