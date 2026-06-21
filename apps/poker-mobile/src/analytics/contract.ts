/**
 * Analytics contract (PR #8) — PURE mapping from the workbook's canonical analytics events
 * (Analytics_Events sheet, 0.8.0) to their warehouse ExportTable + required/optional field contracts.
 *
 * This is the vendor-NEUTRAL spine: it knows nothing about Amplitude/PostHog/Segment or the app's live
 * `track()` seam. It turns the exported contract into typed lookups so a later sink can validate and route
 * events to the right fact/dim table. No fabrication — every field is parsed verbatim from the artifact.
 */
import type { Row } from '../content/types';

export interface AnalyticsContractEvent {
  eventId: string;
  eventName: string;
  trigger: string;
  contentIdRef: string;
  requiredFields: string[];
  optionalFields: string[];
  /** Target warehouse table (e.g. fact_quiz_attempts, dim_sessions). */
  exportTable: string;
  masteryRelevant: boolean;
  description: string;
}

export interface AnalyticsContract {
  datasetVersion: string;
  /** All events in source order. */
  events: AnalyticsContractEvent[];
  /** eventName → event. */
  byName: Map<string, AnalyticsContractEvent>;
  /** exportTable → events feeding it (many events can share one table). */
  byExportTable: Map<string, AnalyticsContractEvent[]>;
}

export interface AnalyticsContractData {
  dataset_version?: string;
  events?: Row[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Split a workbook `;`-delimited field list into trimmed, non-empty field names. */
export function parseFieldList(v: unknown): string[] {
  return str(v)
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function isWellFormed(r: Row): boolean {
  return str(r.EventName).length > 0 && str(r.ExportTable).length > 0;
}

/** Build the contract from the parsed artifact. Malformed rows are dropped; duplicate event names keep first. */
export function buildAnalyticsContract(data: AnalyticsContractData | null | undefined): AnalyticsContract {
  const datasetVersion = str(data?.dataset_version) || 'unknown';
  const events: AnalyticsContractEvent[] = [];
  const byName = new Map<string, AnalyticsContractEvent>();
  const byExportTable = new Map<string, AnalyticsContractEvent[]>();

  const rows = Array.isArray(data?.events) ? data!.events! : [];
  for (const r of rows) {
    if (!isWellFormed(r)) continue;
    const eventName = str(r.EventName);
    if (byName.has(eventName)) continue;
    const ev: AnalyticsContractEvent = {
      eventId: str(r.EventID),
      eventName,
      trigger: str(r.Trigger),
      contentIdRef: str(r.ContentIDRef),
      requiredFields: parseFieldList(r.RequiredFields),
      optionalFields: parseFieldList(r.OptionalFields),
      exportTable: str(r.ExportTable),
      masteryRelevant: str(r.MasteryRelevant).trim().toLowerCase() === 'yes',
      description: str(r.Description),
    };
    events.push(ev);
    byName.set(eventName, ev);
    const bucket = byExportTable.get(ev.exportTable);
    if (bucket) bucket.push(ev);
    else byExportTable.set(ev.exportTable, [ev]);
  }

  return { datasetVersion, events, byName, byExportTable };
}

export function eventByName(contract: AnalyticsContract | null, eventName: string): AnalyticsContractEvent | null {
  return contract?.byName.get(eventName) ?? null;
}

export function exportTableFor(contract: AnalyticsContract | null, eventName: string): string | null {
  return eventByName(contract, eventName)?.exportTable ?? null;
}

/** Events the mastery engine consumes (MasteryRelevant = Yes). */
export function masteryRelevantEvents(contract: AnalyticsContract | null): AnalyticsContractEvent[] {
  return (contract?.events ?? []).filter(e => e.masteryRelevant);
}
