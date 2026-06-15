import { Text, TextInput, StyleSheet, TextStyle } from 'react-native';

/**
 * Inter is the app-wide UI/body typeface. @expo-google-fonts loads each weight
 * under its OWN family name (Inter_700Bold, etc.), so a plain `fontWeight: '700'`
 * cannot switch faces on its own — we resolve weight → concrete family here and
 * apply it globally (see applyInterDefault). DM Serif Display stays the display
 * face for hero titles + money numerals and is preserved as an explicit family.
 */
export const Inter = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
} as const;

/**
 * Sora — the geometric heading / UI-chrome face (titles, labels, caps, buttons,
 * tab labels). Set explicitly on typography tokens; the global patch below respects
 * any explicit family and normalises fontWeight, so these render at their true weight.
 * Inter stays the body face; DM Serif Display stays the display/hero-numeral face.
 */
export const Sora = {
  '500': 'Sora_500Medium',
  '600': 'Sora_600SemiBold',
  '700': 'Sora_700Bold',
  '800': 'Sora_800ExtraBold',
} as const;

export function interFamilyForWeight(weight?: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
      return Inter['400'];
    case '500':
      return Inter['500'];
    case '600':
      return Inter['600'];
    case '700':
    case 'bold':
      return Inter['700'];
    case '800':
    case '900':
      return Inter['800'];
    default:
      return Inter['400'];
  }
}

let patched = false;

/**
 * Make Inter the default for every <Text>/<TextInput> in the app, mapping each
 * element's fontWeight to the matching Inter family. We also normalise
 * fontWeight to 'normal' once a concrete family is set: each Inter face is
 * registered as a normal-weight @font-face on web, so leaving fontWeight:'700'
 * would trigger faux-bold synthesis on top of an already-bold face.
 *
 * Any explicit non-Inter family (DM Serif display tokens, tabular mono) is kept.
 * Call once at module load — the patch only sets family names, so it is safe to
 * run before the font files finish loading.
 */
export function applyInterDefault(): void {
  if (patched) return;
  patched = true;
  for (const Comp of [Text, TextInput] as any[]) {
    const oldRender = Comp.render;
    if (typeof oldRender !== 'function') continue;
    Comp.render = function patchedRender(props: any, ref: any) {
      const flat = StyleSheet.flatten(props?.style) || {};
      const explicit = flat.fontFamily;
      // Respect any explicit family (DM Serif display, ionicons, an Inter weight
      // chosen directly); otherwise resolve the fontWeight to its Inter face.
      const family =
        typeof explicit === 'string' && explicit
          ? explicit
          : interFamilyForWeight(flat.fontWeight);
      const merged = [props?.style, { fontFamily: family, fontWeight: 'normal' as const }];
      return oldRender.call(this, { ...props, style: merged }, ref);
    };
  }
}
