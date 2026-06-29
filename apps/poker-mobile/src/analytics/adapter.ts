/**
 * Vendor-neutral analytics adapter (PR #8) — PURE. Validates an emitted event payload against the
 * contract (required fields present) and maps it to a warehouse-bound ExportRecord keyed by ExportTable.
 *
 * No vendor SDK and no side effects: this is the transform a future sink (warehouse loader / Amplitude /
 * PostHog / Segment) consumes. It does not touch the app's live `track()` seam, so wiring it later is
 * additive and production stays byte-identical until then.
 */
import {
  type AnalyticsContract,
  type AnalyticsContractEvent,
  eventByName,
} from './contract';

export type EventPayload = Record<string, string | number | boolean | null | undefined>;

/** A validated, table-routed record ready for a warehouse sink. */
export interface ExportRecord {
  exportTable: string;
  eventName: string;
  masteryRelevant: boolean;
  /** Required fields (contract order) followed by any present optional fields (contract order). */
  record: EventPayload;
}

export type AdapterResult =
  | { ok: true; export: ExportRecord }
  | { ok: false; reason: 'unknown_event'; eventName: string }
  | { ok: false; reason: 'missing_required'; eventName: string; missing: string[] };

const isPresent = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

/** Which required fields are absent/empty in the payload (contract order). */
export function missingRequired(event: AnalyticsContractEvent, payload: EventPayload): string[] {
  return event.requiredFields.filter(f => !isPresent(payload[f]));
}

/**
 * Validate + map an event payload to an ExportRecord. Returns a typed failure when the event is unknown
 * or required fields are missing — never throws, never fabricates a value. The mapped `record` carries the
 * required fields plus any optional fields that are present (extra/unknown payload keys are dropped, so the
 * warehouse table contract is respected).
 */
export function mapToExportRecord(
  contract: AnalyticsContract | null,
  eventName: string,
  payload: EventPayload,
): AdapterResult {
  const event = eventByName(contract, eventName);
  if (!event) return { ok: false, reason: 'unknown_event', eventName };

  const missing = missingRequired(event, payload);
  if (missing.length) return { ok: false, reason: 'missing_required', eventName, missing };

  const record: EventPayload = {};
  for (const f of event.requiredFields) record[f] = payload[f];
  for (const f of event.optionalFields) if (isPresent(payload[f])) record[f] = payload[f];

  return {
    ok: true,
    export: {
      exportTable: event.exportTable,
      eventName: event.eventName,
      masteryRelevant: event.masteryRelevant,
      record,
    },
  };
}
