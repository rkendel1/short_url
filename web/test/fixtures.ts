/** Rows shaped like production data written before 1_safe_mutations. */
export const LEGACY_OWNER = 'legacyowner0123456789abcdef01234';

export const LEGACY = [
  { code: 'legacyPlain', url: 'https://legacy.example/plain', clicks: 7, created: 1754000000, updated: null, owner: LEGACY_OWNER, pin: null },
  { code: 'legacyPin', url: 'https://legacy.example/pinned', clicks: 0, created: 1754000001, updated: 1754000100, owner: LEGACY_OWNER, pin: '12' },
  { code: 'legacyPinBrute', url: 'https://legacy.example/brute', clicks: 0, created: 1754000002, updated: null, owner: LEGACY_OWNER, pin: '9876' },
  { code: 'legacyScript', url: 'javascript:alert(1)', clicks: 0, created: 1754000003, updated: null, owner: LEGACY_OWNER, pin: null },
] as const;
