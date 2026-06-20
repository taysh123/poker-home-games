/**
 * Themed Markdown renderer (PR #3) — wraps `react-native-markdown-display` with Velvet Table tokens.
 * Used to render lesson `BodyText` (workbook-canonical Markdown). Works on native + web.
 */
import React from 'react';
import RNMarkdown from 'react-native-markdown-display';
import { colors } from '../theme/colors';

// Style map keyed by markdown element (react-native-markdown-display contract). Themed to tokens.
const mdStyles = {
  body: { color: colors.textHigh, fontSize: 15, lineHeight: 22 },
  heading1: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  heading2: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  heading3: { color: colors.textHigh, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 2 },
  paragraph: { marginTop: 0, marginBottom: 10 },
  strong: { color: colors.goldLight, fontWeight: '700' },
  em: { fontStyle: 'italic' },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { color: colors.textHigh, marginVertical: 2 },
  code_inline: { backgroundColor: colors.surfaceHigh, color: colors.goldLight, paddingHorizontal: 4, borderRadius: 4 },
  fence: { backgroundColor: colors.surfaceHigh, color: colors.textHigh, padding: 10, borderRadius: 8 },
  link: { color: colors.gold },
  blockquote: { backgroundColor: colors.surface, borderLeftColor: colors.gold, borderLeftWidth: 3, paddingHorizontal: 10 },
};

export default function Markdown({ children }: { children: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RNMarkdown style={mdStyles as any}>{children}</RNMarkdown>;
}
