import { buildTrainerHand } from '../trainerHand';

describe('buildTrainerHand', () => {
  it('vs_RFI: villain opens, blinds posted, hero faces the raise', () => {
    const snap = buildTrainerHand({
      tableSize: 6, scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: 'CO', stackBb: 100, openSizeBb: 2.5,
    });
    expect(snap.seats).toHaveLength(6);
    expect(snap.seats[0]).toMatchObject({ position: 'BB', state: 'hero', isNext: true });

    const co = snap.seats.find(s => s.position === 'CO')!;
    expect(co).toMatchObject({ state: 'active', action: 'raise', committedBb: 2.5, stackBb: 97.5, hasActed: true });

    const hero = snap.seats.find(s => s.position === 'BB')!;
    expect(hero).toMatchObject({ committedBb: 1, stackBb: 99 });

    // pot = SB 0.5 + BB 1 + CO 2.5
    expect(snap.potBb).toBe(4);
    expect(snap.toCallBb).toBe(1.5); // open 2.5 − hero's posted 1
  });

  it('vs_RFI: timeline runs blinds → action up to hero, ending with the hero step', () => {
    const snap = buildTrainerHand({
      tableSize: 6, scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: 'CO', stackBb: 100, openSizeBb: 2.5,
    });
    expect(snap.timeline[0]).toMatchObject({ position: 'SB', action: 'post', amountBb: 0.5 });
    expect(snap.timeline[1]).toMatchObject({ position: 'BB', action: 'post', amountBb: 1 });
    expect(snap.timeline.find(t => t.action === 'raise')).toMatchObject({ position: 'CO', amountBb: 2.5 });
    expect(snap.timeline.filter(t => t.action === 'fold').map(t => t.position).sort()).toEqual(['BTN', 'HJ', 'SB', 'UTG']);
    const last = snap.timeline[snap.timeline.length - 1];
    expect(last).toMatchObject({ position: 'BB', isHero: true });
    expect(last.action).toBeUndefined();
  });

  it('RFI: folded to hero — hero opens (toCall 0), seats after hero are still to act', () => {
    const snap = buildTrainerHand({ tableSize: 6, scenario: 'RFI', heroPosition: 'CO', stackBb: 40 });
    expect(snap.seats[0]).toMatchObject({ position: 'CO', state: 'hero' });
    expect(snap.toCallBb).toBe(0);
    expect(snap.potBb).toBe(1.5); // just the blinds

    const active = snap.seats.filter(s => s.state === 'active').map(s => s.position).sort();
    const folded = snap.seats.filter(s => s.state === 'folded').map(s => s.position).sort();
    expect(active).toEqual(['BB', 'BTN', 'SB']);
    expect(folded).toEqual(['HJ', 'UTG']);

    // Blinds carry their posted chips even though hero hasn't acted.
    expect(snap.seats.find(s => s.position === 'BB')).toMatchObject({ committedBb: 1, stackBb: 39 });
    expect(snap.seats.find(s => s.position === 'SB')).toMatchObject({ committedBb: 0.5, stackBb: 39.5 });
  });

  it('heads-up: the Button posts the small blind', () => {
    const snap = buildTrainerHand({ tableSize: 2, scenario: 'RFI', heroPosition: 'BTN', stackBb: 100 });
    expect(snap.seats.find(s => s.position === 'BTN')).toMatchObject({ committedBb: 0.5, stackBb: 99.5 });
    expect(snap.seats.find(s => s.position === 'BB')).toMatchObject({ committedBb: 1, stackBb: 99 });
    expect(snap.potBb).toBe(1.5);
    expect(snap.toCallBb).toBe(0);
    expect(snap.timeline[0]).toMatchObject({ position: 'BTN', action: 'post', amountBb: 0.5 });
  });

  it('heads-up vs_RFI: villain raise total absorbs its blind; hero faces the difference', () => {
    const snap = buildTrainerHand({
      tableSize: 2, scenario: 'vs_RFI', heroPosition: 'BB', villainPosition: 'BTN', stackBb: 100, openSizeBb: 3,
    });
    expect(snap.seats.find(s => s.position === 'BTN')).toMatchObject({ action: 'raise', committedBb: 3, stackBb: 97 });
    expect(snap.seats.find(s => s.position === 'BB')).toMatchObject({ committedBb: 1, stackBb: 99 });
    expect(snap.potBb).toBe(4); // open 3 + BB 1
    expect(snap.toCallBb).toBe(2);
  });

  it('stacks always equal start minus committed', () => {
    const snap = buildTrainerHand({
      tableSize: 9, scenario: 'vs_RFI', heroPosition: 'BTN', villainPosition: 'UTG', stackBb: 50, openSizeBb: 2.2,
    });
    for (const s of snap.seats) {
      expect(s.stackBb).toBeCloseTo(50 - s.committedBb, 5);
    }
  });
});
