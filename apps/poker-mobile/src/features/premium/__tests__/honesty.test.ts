import { PREMIUM_FEATURES } from '../config';

describe('honesty gate (spec §10)', () => {
  it('has exactly ONE live (comingSoon:false) premium feature and it is premium_study', () => {
    const live = PREMIUM_FEATURES.filter(f => f.comingSoon === false);
    expect(live).toHaveLength(1);
    expect(live[0].key).toBe('premium_study');
  });

  it('every other premium feature is marked comingSoon:true', () => {
    const others = PREMIUM_FEATURES.filter(f => f.key !== 'premium_study');
    expect(others.length).toBeGreaterThan(0);
    expect(others.every(f => f.comingSoon === true)).toBe(true);
  });

  it('uses the exact approved premium_study benefit copy', () => {
    const study = PREMIUM_FEATURES.find(f => f.key === 'premium_study');
    expect(study?.desc).toBe(
      'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer',
    );
  });
});
