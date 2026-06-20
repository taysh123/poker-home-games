import {
  objectiveMastery, conceptMastery, packMastery, trackMastery, certificationMastery, MASTERY_CONFIG,
} from '../mastery';
import type { ObjectiveMastery } from '../../types';

const NOW = 1_700_000_000_000;
const daysAgo = (d: number) => NOW - d * 86_400_000;

describe('objectiveMastery (MM-01)', () => {
  it('Novice below the learning attempt floor', () => {
    expect(objectiveMastery({ attempts: 2, correct: 2 }, NOW)).toBe('Novice');
  });
  it('Learning when engaged but below proficiency', () => {
    expect(objectiveMastery({ attempts: 12, correct: 6 }, NOW)).toBe('Learning'); // 50%
  });
  it('Proficient at ≥70% over ≥10 attempts', () => {
    expect(objectiveMastery({ attempts: 12, correct: 9 }, NOW)).toBe('Proficient'); // 75%
  });
  it('Mastered at ≥85% over ≥20 attempts (workbook-pinned)', () => {
    expect(objectiveMastery({ attempts: 20, correct: 18 }, NOW)).toBe('Mastered'); // 90%
  });
  it('high accuracy but <20 attempts is not Mastered', () => {
    expect(objectiveMastery({ attempts: 15, correct: 15 }, NOW)).toBe('Proficient');
  });
  it('demotes one level after 30 days inactivity (MM-01)', () => {
    const stat = { attempts: 20, correct: 18, lastActivityTs: daysAgo(40) };
    expect(objectiveMastery(stat, NOW)).toBe('Proficient'); // Mastered → Proficient
  });
  it('no demotion within 30 days', () => {
    expect(objectiveMastery({ attempts: 20, correct: 18, lastActivityTs: daysAgo(10) }, NOW)).toBe('Mastered');
  });
});

describe('boundary cases', () => {
  it('exactly 20 attempts at exactly 85% is Mastered (inclusive)', () => {
    expect(objectiveMastery({ attempts: 20, correct: 17 }, NOW)).toBe('Mastered'); // 85.0%
  });
  it('exactly 30 days inactivity does NOT demote (strict >)', () => {
    expect(objectiveMastery({ attempts: 20, correct: 18, lastActivityTs: daysAgo(30) }, NOW)).toBe('Mastered');
  });
  it('decay is floored at Novice and demotes Learning→Novice', () => {
    expect(objectiveMastery({ attempts: 2, correct: 0, lastActivityTs: daysAgo(90) }, NOW)).toBe('Novice');
    expect(objectiveMastery({ attempts: 12, correct: 6, lastActivityTs: daysAgo(90) }, NOW)).toBe('Novice'); // Learning→Novice
  });
  it('pack distinguishes Started (all Novice) from InProgress', () => {
    expect(packMastery(['Novice', 'Novice'])).toBe('Started');
    expect(packMastery(['Learning', 'Novice'])).toBe('InProgress');
  });
  it('track distinguishes Enrolled (all Novice) from Progressing', () => {
    expect(trackMastery([['Novice'], ['Novice']])).toBe('Enrolled');
    expect(trackMastery([['Learning'], ['Novice']])).toBe('Progressing');
  });
  it('cert: exactly 80% exam passes; exactly 180 days still Certified', () => {
    expect(certificationMastery({ trackComplete: true, examScore: 0.8 }, NOW)).toBe('Certified');
    expect(certificationMastery({ trackComplete: true, certifiedTs: daysAgo(180) }, NOW)).toBe('Certified');
  });
  it('cert: certifiedTs takes precedence over examInProgress', () => {
    expect(certificationMastery({ trackComplete: true, certifiedTs: daysAgo(10), examInProgress: true }, NOW)).toBe('Certified');
  });
});

describe('conceptMastery (MM-02)', () => {
  const o = (s: ObjectiveMastery) => s;
  it('Aware with no proficient objectives', () => {
    expect(conceptMastery([o('Novice'), o('Learning')])).toBe('Aware');
  });
  it('Practiced with one proficient+', () => {
    expect(conceptMastery([o('Proficient'), o('Learning')])).toBe('Practiced');
  });
  it('Confident with ≥2 proficient+ (pinned)', () => {
    expect(conceptMastery([o('Proficient'), o('Mastered')])).toBe('Confident');
  });
  it('Expert when all mastered', () => {
    expect(conceptMastery([o('Mastered'), o('Mastered')])).toBe('Expert');
  });
});

describe('packMastery (MM-03)', () => {
  const m = (n: number, total: number): ObjectiveMastery[] =>
    Array.from({ length: total }, (_, i) => (i < n ? 'Mastered' : 'Learning'));
  it('Started when empty', () => expect(packMastery([])).toBe('Started'));
  it('InProgress below the 80% gate', () => expect(packMastery(m(3, 10))).toBe('InProgress'));
  it('Completed at ≥80% mastered (pinned)', () => expect(packMastery(m(8, 10))).toBe('Completed'));
  it('Mastered at 100%', () => expect(packMastery(m(10, 10))).toBe('Mastered'));
});

describe('trackMastery (MM-04)', () => {
  const complete: ObjectiveMastery[] = ['Proficient', 'Mastered'];
  const partial: ObjectiveMastery[] = ['Learning', 'Novice'];
  it('Enrolled when no modules', () => expect(trackMastery([])).toBe('Enrolled'));
  it('Progressing below the 90% gate', () => {
    expect(trackMastery([complete, partial, partial])).toBe('Progressing');
  });
  it('Track-Complete at ≥90% modules complete (pinned)', () => {
    expect(trackMastery(Array.from({ length: 10 }, (_, i) => (i < 9 ? complete : partial)))).toBe('Track-Complete');
  });
});

describe('certificationMastery (MM-05)', () => {
  it('Eligible when track-complete but no exam', () => {
    expect(certificationMastery({ trackComplete: true }, NOW)).toBe('Eligible');
  });
  it('InExam during an attempt', () => {
    expect(certificationMastery({ trackComplete: true, examInProgress: true }, NOW)).toBe('InExam');
  });
  it('Certified on exam≥80% + track-complete (pinned)', () => {
    expect(certificationMastery({ trackComplete: true, examScore: 0.85 }, NOW)).toBe('Certified');
  });
  it('not Certified if exam passes but track incomplete', () => {
    expect(certificationMastery({ trackComplete: false, examScore: 0.9 }, NOW)).toBe('Eligible');
  });
  it('Expired after 180 days (recert)', () => {
    expect(certificationMastery({ trackComplete: true, certifiedTs: daysAgo(200) }, NOW)).toBe('Expired');
  });
  it('Certified within 180 days', () => {
    expect(certificationMastery({ trackComplete: true, certifiedTs: daysAgo(100) }, NOW)).toBe('Certified');
  });
});
