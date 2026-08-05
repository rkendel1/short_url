const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const ADJECTIVES = [
  'happy', 'lucky', 'swift', 'bright', 'bold', 'quick', 'smart', 'keen',
  'agile', 'rapid', 'fresh', 'clean', 'sharp', 'crisp', 'vivid', 'quiet',
  'gentle', 'strong', 'brave', 'eager', 'witty', 'zippy', 'sleek', 'slick',
];

const NOUNS = [
  'panda', 'eagle', 'tiger', 'shark', 'falcon', 'whale', 'otter', 'deer',
  'fox', 'wolf', 'raven', 'bear', 'lynx', 'stag', 'elk', 'hare',
  'seal', 'hawk', 'owl', 'dove', 'swan', 'mule', 'gecko', 'newt',
];

export function generateMemorable(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 10000).toString().padStart(3, '0');
  return `${adj}-${noun}-${num}`;
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
