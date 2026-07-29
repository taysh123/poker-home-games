import { readFileSync } from 'fs';
import { resolve } from 'path';

import { groupMetaLine, groupRowLabel } from '../groupRow';

/**
 * Expected strings are LITERALS, not rebuilt from the functions under test or from `formatPL`, so a
 * test cannot follow the code it guards. Currency is the module default (ILS).
 *
 * Each case is a defect that shipped: a plural rule written twice with two answers, a visible P&L
 * missing from the spoken name, and two screens describing the same group differently.
 */
describe('groupMetaLine — one string, displayed and announced', () => {
  it('pluralises members', () => {
    expect(groupMetaLine(1)).toBe('1 member');
    expect(groupMetaLine(4)).toBe('4 members');
  });

  it('pluralises sessions — "1 session", never "1 sessions"', () => {
    expect(groupMetaLine(2, 1)).toBe('2 members · 1 session');
    expect(groupMetaLine(2, 12)).toBe('2 members · 12 sessions');
  });

  it('omits sessions entirely when the user has played none', () => {
    expect(groupMetaLine(3, 0)).toBe('3 members');
    expect(groupMetaLine(3, null)).toBe('3 members');
    expect(groupMetaLine(3)).toBe('3 members');
  });
});

describe('groupRowLabel — the spoken name matches the rendered row', () => {
  it('includes role, meta and the P&L the row displays', () => {
    expect(groupRowLabel({ name: 'Poker Crew', role: 'Owner', memberCount: 4, myGroupSessions: 12, myGroupPL: -450 }))
      .toBe('Poker Crew, Owner, 4 members · 12 sessions, -₪450');
  });

  it('includes the description where a row renders one', () => {
    // GroupsListScreen's card shows a description; GroupListItem does not. Same function, and the
    // term appears only when the caller actually renders it.
    expect(groupRowLabel({ name: 'Poker Crew', role: 'Admin', description: 'Thursday regulars', memberCount: 2, myGroupPL: 900 }))
      .toBe('Poker Crew, Admin, Thursday regulars, 2 members, +₪900');
  });

  it('omits an absent P&L rather than announcing zero', () => {
    expect(groupRowLabel({ name: 'New Crew', memberCount: 2, myGroupSessions: 0 })).toBe('New Crew, 2 members');
  });

  it('announces a break-even group as +₪0 only when the row shows it', () => {
    expect(groupRowLabel({ name: 'Even Crew', memberCount: 2, myGroupPL: 0 })).toBe('Even Crew, 2 members, +₪0');
  });

  it('says nothing about a plain member', () => {
    // role is only rendered as a chip for Owner/Admin; "Member" has no visible counterpart.
    expect(groupRowLabel({ name: 'Crew', role: 'Member', memberCount: 5 })).toBe('Crew, 5 members');
  });

  it('treats an empty description as absent', () => {
    expect(groupRowLabel({ name: 'Crew', description: '', memberCount: 5 })).toBe('Crew, 5 members');
  });
});

/**
 * A shared helper only removes drift if both rows actually USE it.
 *
 * `GroupListItem` is pinned behaviourally by a11yContract.test.tsx, which renders it. The
 * `GroupsListScreen` card is not rendered by any test — reverting its label to the old
 * name-and-member-count string left the whole suite green, which is the same unpinned-fix shape
 * this slice exists to close. Until that screen has a render test, a source-level pin makes the
 * revert loud. It proves the call site exists; it cannot prove what the screen announces at runtime.
 */
describe('both group rows are wired to the shared helper', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');

  // Whitespace-tolerant on purpose: an exact substring made a behaviour-preserving reformat (or a
  // Prettier line-wrap) fail with zero change in behaviour. A pin that cries wolf on a no-op edit
  // gets deleted by the next person, which is worse than not having it.
  it('GroupsListScreen composes its card label and meta line from groupRow', () => {
    const src = read('screens/GroupsListScreen.tsx');
    expect(src).toMatch(/accessibilityLabel=\{\s*groupRowLabel\(\s*item\s*\)\s*\}/);
    expect(src).toMatch(/groupMetaLine\(\s*item\.memberCount\s*,\s*item\.myGroupSessions\s*\)/);
  });

  it('GroupListItem composes its label and meta line from groupRow', () => {
    const src = read('components/GroupListItem.tsx');
    expect(src).toMatch(/accessibilityLabel=\{\s*groupRowLabel\(/);
    expect(src).toMatch(/groupMetaLine\(\s*memberCount\s*,\s*myGroupSessions\s*\)/);
  });

  it('neither row hand-rolls a session count of its own', () => {
    // Narrow on purpose. This is a substring check over source, so it catches the literal that
    // disagreed with itself and nothing subtler — it would not notice the same string rebuilt a
    // different way. The behavioural guarantee lives in groupMetaLine's own tests above; this only
    // stops the deleted duplication growing back in place.
    for (const rel of ['screens/GroupsListScreen.tsx', 'components/GroupListItem.tsx']) {
      const src = read(rel);
      expect(src).not.toMatch(/\bsessions?\$\{/);
      expect(src).not.toMatch(/\$\{[^}]*\}\s*sessions?\b/);
    }
  });
});
