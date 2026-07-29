import { formatPL } from './formatters';

/**
 * The one description of a group row.
 *
 * A group row is rendered by TWO independent implementations — `components/GroupListItem` (Home)
 * and a hand-rolled card in `screens/GroupsListScreen` — showing the same facts: name, Owner/Admin,
 * an optional description, "N members · M sessions", and the user's P&L in that group.
 *
 * They had drifted three ways at once. Both carried an accessible name, but one stopped at the
 * member count, dropping the role, the sessions and the P&L that are all on screen; the other
 * omitted the P&L; and both wrote the session plural by hand, one of them wrongly ("1 sessions").
 * (An earlier version of this header said "only one carried an accessible name at all". That was
 * false — it was incomplete, not absent — and three sibling comments in the same commit said so.
 * Recorded rather than quietly corrected, since this module exists because of exactly that habit.)
 *
 * Composing the visible meta line and the spoken name from the SAME value removes the plural drift
 * structurally. It does not remove every possible drift: which TERMS appear is still a judgement
 * written here and mirrored in two JSX trees, and only the meta line is pinned against rendered
 * output (a11yContract). Narrower than "structurally impossible", which is what this said first.
 */
export type GroupRow = {
  name: string;
  role?: string;
  memberCount: number;
  myGroupSessions?: number | null;
  myGroupPL?: number | null;
  description?: string | null;
};

/** The meta line both rows display verbatim: "4 members · 12 sessions". */
export function groupMetaLine(memberCount: number, myGroupSessions?: number | null): string {
  const members = `${memberCount} member${memberCount === 1 ? '' : 's'}`;
  if (!myGroupSessions) return members;
  return `${members} · ${myGroupSessions} session${myGroupSessions === 1 ? '' : 's'}`;
}

/**
 * The accessible name for a group row. Every term is CHOSEN to mirror a rendered element, in screen
 * order — reviewed, not enforced: this is a pure function of props and never sees the tree, and only
 * the meta line is asserted against rendered output.
 *
 * Why omissions matter more than order here: the row is a single accessibility element, so a value
 * left out is unreachable rather than merely late. That comes from `accessible` — which `Pressable`
 * defaults to true — NOT from `accessibilityRole`, as an earlier version of this comment said. The
 * distinction matters because the same paragraph argues the P&L was a REGRESSION: before an explicit
 * label existed iOS derived a name from the descendant <Text> nodes (RCTView.m:244), which only
 * happens for an element that was already accessible. Blaming the role contradicted that argument.
 */
export function groupRowLabel(g: GroupRow): string {
  return [
    g.name,
    g.role === 'Owner' ? 'Owner' : g.role === 'Admin' ? 'Admin' : null,
    g.description || null,
    groupMetaLine(g.memberCount, g.myGroupSessions),
    g.myGroupPL != null ? formatPL(g.myGroupPL) : null,
  ]
    .filter(Boolean)
    .join(', ');
}
