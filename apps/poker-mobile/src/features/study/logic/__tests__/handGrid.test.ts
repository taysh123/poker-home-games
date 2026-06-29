import { allHands, expandToken, expandRange, buildStrategy } from '../handGrid';

describe('allHands', () => {
  it('produces the 169 canonical hands (13 pairs + 78 suited + 78 offsuit)', () => {
    const hands = allHands();
    expect(hands).toHaveLength(169);
    expect(new Set(hands).size).toBe(169);
    expect(hands.filter(h => h.length === 2)).toHaveLength(13);
    expect(hands.filter(h => h.endsWith('s'))).toHaveLength(78);
    expect(hands.filter(h => h.endsWith('o'))).toHaveLength(78);
    expect(hands).toContain('AA');
    expect(hands).toContain('AKs');
    expect(hands).toContain('AKo');
  });
});

describe('expandToken', () => {
  it('expands pair-plus', () => {
    expect(expandToken('TT+')).toEqual(['TT', 'JJ', 'QQ', 'KK', 'AA']);
  });
  it('expands suited-plus up to one below the top card', () => {
    expect(expandToken('KTs+')).toEqual(['KTs', 'KJs', 'KQs']);
    expect(expandToken('A2s+')).toHaveLength(12); // A2s..AKs
  });
  it('expands offsuit-plus', () => {
    expect(expandToken('AJo+')).toEqual(['AJo', 'AQo', 'AKo']);
  });
  it('handles exact hands', () => {
    expect(expandToken('99')).toEqual(['99']);
    expect(expandToken('KQs')).toEqual(['KQs']);
  });
  it('rejects malformed tokens', () => {
    expect(() => expandToken('ZZ')).toThrow();
    expect(() => expandToken('2As')).toThrow(); // low card first is invalid
  });
});

describe('expandRange', () => {
  it('expands + de-duplicates a comma list', () => {
    const r = expandRange('77+, AKs, AKs');
    expect(r).toContain('77');
    expect(r).toContain('AA');
    expect(r.filter(h => h === 'AKs')).toHaveLength(1);
  });
});

describe('buildStrategy', () => {
  it('assigns raise/call/fold across all 169 hands (raise wins ties)', () => {
    const strat = buildStrategy({ raise: 'QQ+', call: 'JJ, QQ' });
    expect(Object.keys(strat)).toHaveLength(169);
    expect(strat['AA']).toEqual([{ action: 'raise', freq: 1 }]);
    expect(strat['QQ']).toEqual([{ action: 'raise', freq: 1 }]); // raise precedence over call
    expect(strat['JJ']).toEqual([{ action: 'call', freq: 1 }]);
    expect(strat['72o']).toEqual([{ action: 'fold', freq: 1 }]);
  });
});
