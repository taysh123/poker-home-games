/**
 * PackTierChip — verbatim `MarketableAs` as a Chip, with the honesty gate: the gold solid + shield treatment
 * is granted ONLY for the verified tier (`tierBadge === 'gto_verified'`, i.e. PctVerifiedOrNash ≥ 95).
 * Shared by the Pack Catalog + Pack Detail so the label treatment can't drift between them.
 */
import React from 'react';
import Chip from '../../../components/Chip';
import type { Pack } from '../logic/marketableLabel';

export default function PackTierChip({ pack }: { pack: Pack }) {
  if (pack.tierBadge === 'gto_verified') return <Chip label={pack.marketableAs} tone="gold" solid icon="shield-checkmark" />;
  if (pack.tierBadge === 'expert_calibrated') return <Chip label={pack.marketableAs} tone="gold" />;
  return <Chip label={pack.marketableAs} tone="neutral" />;
}
