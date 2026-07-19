import { PREMIUM_FEATURES } from '../config';

describe('honesty gate (free-first launch)', () => {
  it('has ZERO live features — every premium benefit is comingSoon:true', () => {
    expect(PREMIUM_FEATURES.filter(f => f.comingSoon === false)).toHaveLength(0);
    expect(PREMIUM_FEATURES.length).toBeGreaterThanOrEqual(4);
    expect(PREMIUM_FEATURES.every(f => f.comingSoon === true)).toBe(true);
  });

  it('uses the exact approved premium_study benefit copy', () => {
    const study = PREMIUM_FEATURES.find(f => f.key === 'premium_study');
    expect(study?.desc).toBe(
      'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer',
    );
  });
});
