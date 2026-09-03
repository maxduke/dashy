import { describe, it, expect } from 'vitest';
import { parseIcs } from '@/utils/IcsParser';

/* Wrap VEVENT bodies in a minimal calendar */
const calendar = (...events) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  ...events.map((event) => `BEGIN:VEVENT\r\n${event}\r\nEND:VEVENT`),
  'END:VCALENDAR',
].join('\r\n');

const between = (from, to) => ({
  start: Date.parse(`${from}T00:00:00Z`),
  end: Date.parse(`${to}T00:00:00Z`),
});

const starts = (events) => events.map((event) => new Date(event.start).toISOString());
const days = (events) => events.map((event) => new Date(event.start).toISOString().slice(0, 10));

describe('IcsParser', () => {
  it('rejects anything that is not a calendar', () => {
    expect(() => parseIcs('<html>nope</html>', between('2026-01-01', '2026-12-31'))).toThrow();
    expect(() => parseIcs('', between('2026-01-01', '2026-12-31'))).toThrow();
  });

  it('unfolds wrapped lines and unescapes text', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART:20260904T090000Z',
      'SUMMARY:Quarterly planning\\, budget review',
      'DESCRIPTION:First line\\nSecond line',
      'LOCATION:Room A\\; upstairs\\, near the very long corridor that keeps',
      '  going',
    ].join('\r\n'));
    const [event] = parseIcs(ics, between('2026-09-01', '2026-09-30'));
    expect(event.summary).toBe('Quarterly planning, budget review');
    expect(event.description).toBe('First line\nSecond line');
    expect(event.location).toBe('Room A; upstairs, near the very long corridor that keeps going');
  });

  it('anchors all-day events to UTC, so the date never drifts', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART;VALUE=DATE:20261225',
      'DTEND;VALUE=DATE:20261226',
      'SUMMARY:Christmas Day',
    ].join('\r\n'));
    const [event] = parseIcs(ics, between('2026-12-01', '2026-12-31'));
    expect(event.allDay).toBe(true);
    expect(new Date(event.start).toISOString()).toBe('2026-12-25T00:00:00.000Z');
  });

  it('reads UTC times, and end times from either DTEND or DURATION', () => {
    const ics = calendar(
      ['UID:1', 'DTSTART:20260904T090000Z', 'DTEND:20260904T103000Z', 'SUMMARY:With end'].join('\r\n'),
      ['UID:2', 'DTSTART:20260904T140000Z', 'DURATION:PT45M', 'SUMMARY:With duration'].join('\r\n'),
    );
    const events = parseIcs(ics, between('2026-09-01', '2026-09-30'));
    expect(events[0].end - events[0].start).toBe(90 * 60 * 1000);
    expect(events[1].end - events[1].start).toBe(45 * 60 * 1000);
  });

  it('holds a recurring meeting at the same local time across a DST change', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART;TZID=America/New_York:20261028T090000',
      'DTEND;TZID=America/New_York:20261028T100000',
      'RRULE:FREQ=WEEKLY;BYDAY=WE',
      'SUMMARY:Weekly sync',
    ].join('\r\n'));
    const events = parseIcs(ics, between('2026-10-27', '2026-11-05'));
    // New York is UTC-4 on 28 Oct, but UTC-5 on 4 Nov
    expect(starts(events)).toEqual(['2026-10-28T13:00:00.000Z', '2026-11-04T14:00:00.000Z']);
  });

  it('expands a fortnightly rule, honouring INTERVAL', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART:20260907T100000Z',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      'SUMMARY:Fortnightly',
    ].join('\r\n'));
    expect(days(parseIcs(ics, between('2026-09-01', '2026-10-20'))))
      .toEqual(['2026-09-07', '2026-09-21', '2026-10-05', '2026-10-19']);
  });

  it('expands ordinal BYDAY, such as the third Tuesday of the month', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART:20260120T110000Z',
      'RRULE:FREQ=MONTHLY;BYDAY=3TU',
      'SUMMARY:Third Tuesday',
    ].join('\r\n'));
    expect(days(parseIcs(ics, between('2026-01-01', '2026-04-01'))))
      .toEqual(['2026-01-20', '2026-02-17', '2026-03-17']);
  });

  it('expands negative BYMONTHDAY, such as the last day of the month', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART:20260131T080000Z',
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1',
      'SUMMARY:Month end',
    ].join('\r\n'));
    expect(days(parseIcs(ics, between('2026-01-01', '2026-04-01'))))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('applies BYSETPOS, such as the last weekday of the month', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART:20260130T170000Z',
      'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
      'SUMMARY:Last weekday',
    ].join('\r\n'));
    expect(days(parseIcs(ics, between('2026-01-01', '2026-03-01'))))
      .toEqual(['2026-01-30', '2026-02-27']);
  });

  it('stops a rule at COUNT or UNTIL', () => {
    const counted = calendar(['UID:1', 'DTSTART:20260907T090000Z',
      'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:Counted'].join('\r\n'));
    expect(days(parseIcs(counted, between('2026-09-01', '2026-10-01'))))
      .toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);

    const dated = calendar(['UID:1', 'DTSTART:20260907T090000Z',
      'RRULE:FREQ=DAILY;UNTIL=20260909T090000Z', 'SUMMARY:Until'].join('\r\n'));
    expect(days(parseIcs(dated, between('2026-09-01', '2026-10-01'))))
      .toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
  });

  it('skips EXDATEs and adds RDATEs', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART:20260907T090000Z',
      'RRULE:FREQ=DAILY;COUNT=3',
      'EXDATE:20260908T090000Z',
      'RDATE:20260912T090000Z',
      'SUMMARY:Standup',
    ].join('\r\n'));
    expect(days(parseIcs(ics, between('2026-09-01', '2026-10-01'))))
      .toEqual(['2026-09-07', '2026-09-09', '2026-09-12']);
  });

  it('replaces a single occurrence with its RECURRENCE-ID override', () => {
    const ics = calendar(
      ['UID:1', 'DTSTART:20260907T090000Z', 'RRULE:FREQ=DAILY;COUNT=3',
        'SUMMARY:Standup'].join('\r\n'),
      ['UID:1', 'RECURRENCE-ID:20260908T090000Z', 'DTSTART:20260908T160000Z',
        'SUMMARY:Standup (moved)'].join('\r\n'),
    );
    const events = parseIcs(ics, between('2026-09-01', '2026-10-01'));
    expect(starts(events)).toEqual([
      '2026-09-07T09:00:00.000Z', '2026-09-08T16:00:00.000Z', '2026-09-09T09:00:00.000Z',
    ]);
    expect(events[1].summary).toBe('Standup (moved)');
  });

  it('ignores cancelled events and nested components', () => {
    const ics = calendar(
      ['UID:1', 'DTSTART:20260904T090000Z', 'SUMMARY:Cancelled', 'STATUS:CANCELLED'].join('\r\n'),
      ['UID:2', 'DTSTART:20260904T100000Z', 'SUMMARY:Real', 'BEGIN:VALARM',
        'TRIGGER:-PT10M', 'SUMMARY:Reminder', 'END:VALARM'].join('\r\n'),
    );
    const events = parseIcs(ics, between('2026-09-01', '2026-09-30'));
    expect(events.map((event) => event.summary)).toEqual(['Real']);
  });

  it('only returns events that start within the window', () => {
    const ics = calendar(
      ['UID:1', 'DTSTART:20260801T090000Z', 'SUMMARY:Before'].join('\r\n'),
      ['UID:2', 'DTSTART:20260915T090000Z', 'SUMMARY:During'].join('\r\n'),
      ['UID:3', 'DTSTART:20261101T090000Z', 'SUMMARY:After'].join('\r\n'),
    );
    const events = parseIcs(ics, between('2026-09-01', '2026-10-01'));
    expect(events.map((event) => event.summary)).toEqual(['During']);
  });

  it('falls back to local time for timezones it cannot resolve', () => {
    const ics = calendar([
      'UID:1',
      'DTSTART;TZID=GMT Standard Time:20260904T090000',
      'SUMMARY:Outlook style',
    ].join('\r\n'));
    const [event] = parseIcs(ics, between('2026-09-01', '2026-09-30'));
    expect(new Date(event.start).getHours()).toBe(9);
  });
});
