const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const NOUNS = [
  'panda', 'eagle', 'tiger', 'shark', 'falcon', 'whale', 'otter', 'deer',
  'fox', 'wolf', 'raven', 'bear', 'lynx', 'stag', 'elk', 'hare',
  'seal', 'hawk', 'owl', 'dove', 'swan', 'mule', 'gecko', 'newt',
  'moose', 'emu', 'ibis', 'kite', 'lark', 'newt', 'oryx', 'puma',
  'quail', 'roach', 'skua', 'tern', 'uakari', 'vole', 'wren', 'yak',
  'zebra', 'albatross', 'badger', 'coral', 'dolphin', 'emu', 'ferret',
];

export function generateMemorable(): string {
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${noun}${num}`;
}

export function generateBase62(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

export function isValidBase62(code: string): boolean {
  return /^[0-9A-Za-z]+$/.test(code) && code.length > 0 && code.length <= 20;
}
