import { describe, expect, it } from 'vitest';
import { isContractCompatible } from '../src/version';

describe('isContractCompatible', () => {
  it('accepts matching major versions regardless of minor/patch', () => {
    expect(isContractCompatible('1.0.0', '1.4.2')).toBe(true);
    expect(isContractCompatible('1.9.9', '1.0.0')).toBe(true);
  });

  it('rejects a major version mismatch', () => {
    expect(isContractCompatible('2.0.0', '1.9.9')).toBe(false);
    expect(isContractCompatible('1.0.0', '2.0.0')).toBe(false);
  });

  it('rejects malformed version strings', () => {
    expect(isContractCompatible('1.0.0', 'not-a-version')).toBe(false);
    expect(isContractCompatible('1.x.0', '1.0.0')).toBe(false);
  });
});
