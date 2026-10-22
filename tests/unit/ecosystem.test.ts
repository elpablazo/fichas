import { describe, expect, it } from 'vitest';
import { ecosystem } from '../../src/shared/game/ecosystem';

describe('ecosystem', () => {
  it('starts bare and says what comes next', () => {
    const e = ecosystem(0);
    expect(e.has.size).toBe(0);
    expect(e.next).toEqual({ key: 'butterflies', at: 3 });
  });
  it('only adds as flowers grow, in order', () => {
    let seen = 0;
    for (let n = 0; n <= 30; n++) {
      const e = ecosystem(n);
      expect(e.has.size).toBeGreaterThanOrEqual(seen);
      seen = e.has.size;
    }
    expect([...ecosystem(10).has]).toEqual(['butterflies', 'tree', 'bees', 'birds']);
    expect(ecosystem(10).next?.key).toBe('pond');
    expect(ecosystem(21).next).toBeNull();
  });
  it('the tree grows from a sapling to full size', () => {
    expect(ecosystem(5).tree).toBe(0);
    expect(ecosystem(13).tree).toBe(0.5);
    expect(ecosystem(40).tree).toBe(1);
  });
});
