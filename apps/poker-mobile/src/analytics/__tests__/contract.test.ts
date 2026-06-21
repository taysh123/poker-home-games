/**
 * Analytics contract + adapter tests (PR #8). Drives off the REAL bundled artifact so the mapping is
 * proven against actual workbook-derived data (11 events → 9 export tables), plus parsing, validation,
 * vendor-neutral adapter mapping, and flag-gated loading.
 */
jest.mock('../../config/features', () => ({ isFeatureEnabled: jest.fn() }));

import { isFeatureEnabled } from '../../config/features';
import {
  buildAnalyticsContract,
  parseFieldList,
  eventByName,
  exportTableFor,
  masteryRelevantEvents,
  type AnalyticsContractData,
} from '../contract';
import { mapToExportRecord, missingRequired } from '../adapter';
import { loadAnalyticsContract, __resetAnalyticsContractForTests } from '../contractStore';

const realArtifact = require('../../../assets/content/0.8.0/analytics_contract.json') as AnalyticsContractData;
const mockFlag = isFeatureEnabled as jest.Mock;

describe('parseFieldList', () => {
  it('splits a ;-delimited list and trims, dropping empties', () => {
    expect(parseFieldList('user_id; event_ts; module_id')).toEqual(['user_id', 'event_ts', 'module_id']);
    expect(parseFieldList(' a ;; b ')).toEqual(['a', 'b']);
    expect(parseFieldList('')).toEqual([]);
    expect(parseFieldList(null)).toEqual([]);
  });
});

describe('buildAnalyticsContract — real artifact (11 events)', () => {
  const contract = buildAnalyticsContract(realArtifact);

  it('loads all 11 events with the dataset version', () => {
    expect(contract.datasetVersion).toBe('0.8.0');
    expect(contract.events.length).toBe(11);
  });

  it('maps to 9 distinct export tables (quiz + pack events share tables)', () => {
    expect(contract.byExportTable.size).toBe(9);
    expect(contract.byExportTable.get('fact_quiz_attempts')!.map(e => e.eventName))
      .toEqual(['quiz_started', 'quiz_completed']);
    expect(contract.byExportTable.get('fact_pack_engagement')!.map(e => e.eventName))
      .toEqual(['pack_opened', 'pack_completed']);
  });

  it('parses required/optional fields and mastery relevance per event', () => {
    expect(exportTableFor(contract, 'session_started')).toBe('dim_sessions');
    const quizDone = eventByName(contract, 'quiz_completed')!;
    expect(quizDone.requiredFields).toEqual(['user_id', 'event_ts', 'quiz_id', 'score_pct', 'correct', 'total']);
    expect(quizDone.masteryRelevant).toBe(true);
    expect(eventByName(contract, 'lesson_viewed')!.masteryRelevant).toBe(false);
  });

  it('lists exactly the mastery-relevant events', () => {
    expect(masteryRelevantEvents(contract).map(e => e.eventName).sort()).toEqual(
      ['drill_attempted', 'leak_found', 'objective_mastered', 'pack_completed', 'quiz_completed', 'quiz_started'],
    );
  });

  it('every event has a non-empty export table and at least the base required fields', () => {
    for (const e of contract.events) {
      expect(e.exportTable.length).toBeGreaterThan(0);
      expect(e.requiredFields).toEqual(expect.arrayContaining(['user_id', 'event_ts']));
    }
  });
});

describe('buildAnalyticsContract — malformed/empty', () => {
  it('returns an empty contract for null/missing events (never throws)', () => {
    expect(buildAnalyticsContract(null).events).toEqual([]);
    expect(buildAnalyticsContract({ dataset_version: '0.8.0' }).events).toEqual([]);
    expect(buildAnalyticsContract(null).datasetVersion).toBe('unknown');
  });

  it('drops malformed rows and de-dupes event names (keeps first)', () => {
    const data: AnalyticsContractData = {
      dataset_version: '0.8.0',
      events: [
        { EventName: 'a', ExportTable: 't1', RequiredFields: 'user_id' },
        { EventName: 'a', ExportTable: 't2' }, // dupe name
        { ExportTable: 't3' }, // malformed (no name)
        { EventName: 'b', ExportTable: '' }, // malformed (no table)
      ],
    };
    const c = buildAnalyticsContract(data);
    expect(c.events.map(e => e.eventName)).toEqual(['a']);
    expect(eventByName(c, 'a')!.exportTable).toBe('t1');
  });
});

describe('vendor-neutral adapter — mapToExportRecord', () => {
  const contract = buildAnalyticsContract(realArtifact);

  it('maps a valid payload to a table-routed record (required + present optional only)', () => {
    const res = mapToExportRecord(contract, 'quiz_completed', {
      user_id: 'u1', event_ts: '2026-06-21T00:00:00Z', quiz_id: 'Q1',
      score_pct: 80, correct: 8, total: 10, time_ms: 1234, extra_unknown: 'dropped',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.export.exportTable).toBe('fact_quiz_attempts');
    expect(res.export.masteryRelevant).toBe(true);
    expect(res.export.record).toEqual({
      user_id: 'u1', event_ts: '2026-06-21T00:00:00Z', quiz_id: 'Q1',
      score_pct: 80, correct: 8, total: 10, time_ms: 1234,
    });
    expect(res.export.record).not.toHaveProperty('extra_unknown'); // unknown keys dropped
    expect(res.export.record).not.toHaveProperty('objective_id'); // absent optional omitted
  });

  it('fails (typed) on an unknown event', () => {
    const res = mapToExportRecord(contract, 'not_an_event', { user_id: 'u1' });
    expect(res).toEqual({ ok: false, reason: 'unknown_event', eventName: 'not_an_event' });
  });

  it('fails (typed) listing missing required fields', () => {
    const res = mapToExportRecord(contract, 'quiz_completed', { user_id: 'u1', event_ts: 't' });
    expect(res.ok).toBe(false);
    if (res.ok || res.reason !== 'missing_required') throw new Error('expected missing_required');
    expect(res.missing).toEqual(['quiz_id', 'score_pct', 'correct', 'total']);
  });

  it('treats empty string / null as missing required', () => {
    const ev = eventByName(contract, 'session_started')!;
    expect(missingRequired(ev, { user_id: '', event_ts: null, session_id: 's1' }))
      .toEqual(['user_id', 'event_ts']);
  });
});

describe('loadAnalyticsContract — flag gating (byte-identical when OFF)', () => {
  beforeEach(() => __resetAnalyticsContractForTests());

  it('returns null without loading the artifact when content flag is OFF', () => {
    mockFlag.mockReturnValue(false);
    expect(loadAnalyticsContract()).toBeNull();
  });

  it('loads the bundled contract when content flag is ON, memoized', () => {
    mockFlag.mockReturnValue(true);
    const a = loadAnalyticsContract();
    expect(a).not.toBeNull();
    expect(a!.events.length).toBe(11);
    expect(loadAnalyticsContract()).toBe(a);
  });
});
