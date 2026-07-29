import { formatPL } from './formatters';

/**
 * The one description of a group row.
 *
 * A group row is rendered by TWO independent implementations — `components/GroupListItem` (Home)
 * and a hand-rolled card in `screens/GroupsListScreen` — showing the same facts: name, Owner/Admin,
 * an optional description, "N members · M sessions", and the user's P&L in that group.
 *
 * They had drifted three ways at once. Only one carried an accessible name at all; that name
 * omitted the P&L the row visibly renders; and both wrote the session plural by hand, one of them
 * wrongly ("1 sessions"). Composing the visible line and the spoken name from the SAME value here
 * is what makes those failures structurally impossible rather than merely fixed — which is the
 * difference the last a11y slice was created to establish and did not.
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
 * The accessible name for a group row: every term maps to something the row actually renders, in
 * the order it is read on screen.
 *
 * `accessibilityRole="button"` collapses the row to ONE accessibility element, so anything left out
 * here is not merely reordered — it becomes unreachable. That is why the P&L belongs in it: before
 * an explicit label existed, RN derived a name from the child <Text> nodes and the number was
 * included.
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
