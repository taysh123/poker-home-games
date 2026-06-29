import { handAt, RANKS } from '../grid';

describe('range grid mapping', () => {
  it('has 13 ranks', () => expect(RANKS).toHaveLength(13));
  it('diagonal cells are pairs', () => {
    expect(handAt(0, 0)).toBe('AA');
    expect(handAt(12, 12)).toBe('22');
  });
  it('upper triangle is suited', () => {
    expect(handAt(0, 1)).toBe('AKs');
    expect(handAt(0, 12)).toBe('A2s');
  });
  it('lower triangle is offsuit', () => {
    expect(handAt(1, 0)).toBe('AKo');
    expect(handAt(12, 0)).toBe('A2o');
  });
});
