import type { FreeConditions } from '../types/parkingSpot';

export function formatFreeConditions(conditions: FreeConditions): string {
  if (conditions.alwaysFree && !conditions.freeAfter && !conditions.freeBefore && !conditions.freeDays) {
    return 'Free';
  }

  const parts: string[] = [];
  if (conditions.freeAfter) parts.push(`free after ${conditions.freeAfter}`);
  if (conditions.freeBefore) parts.push(`free before ${conditions.freeBefore}`);
  if (conditions.freeDays?.length) parts.push(`free on ${conditions.freeDays.join(', ')}`);
  if (conditions.maxStayMinutes) parts.push(`max stay ${Math.round(conditions.maxStayMinutes / 60)}h`);

  if (parts.length === 0) return conditions.alwaysFree ? 'Free' : 'Conditions unclear — check signage';

  return parts.join(' · ');
}

export interface ParkingWindowSummary {
  headline: string;
  durationLabel: string | null;
  dayBadges: string[];
  maxStayLabel: string | null;
  raw: string | null;
}

function formatMinutesAsDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function toMinutesSinceMidnight(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + mm;
}

function computeWindowDurationMinutes(freeAfter: string, freeBefore: string): number {
  const after = toMinutesSinceMidnight(freeAfter);
  const before = toMinutesSinceMidnight(freeBefore);
  // Overnight wrap (e.g. free 18:00 -> 08:00 next day) is the common case for
  // our parser's output; handle a same-day window defensively too.
  return after > before ? 24 * 60 - after + before : before - after;
}

/**
 * Produces a richer, structured breakdown of a spot's free conditions for
 * display — headline text, an approximate free-window duration ("how many
 * hours free"), day badges, and a separate max-stay label, rather than a
 * single flattened string.
 */
export function describeParkingWindow(conditions: FreeConditions): ParkingWindowSummary {
  const dayBadges = conditions.freeDays ?? [];
  const maxStayLabel = conditions.maxStayMinutes ? `Max stay ${formatMinutesAsDuration(conditions.maxStayMinutes)}` : null;

  if (conditions.alwaysFree && !conditions.freeAfter && !conditions.freeBefore && !dayBadges.length) {
    return {
      headline: 'Free any time',
      durationLabel: conditions.maxStayMinutes ? null : 'No time limit',
      dayBadges: [],
      maxStayLabel,
      raw: conditions.notes ?? null,
    };
  }

  let headline: string;
  let durationLabel: string | null = null;

  if (conditions.freeAfter && conditions.freeBefore) {
    headline = `Free ${conditions.freeAfter}–${conditions.freeBefore}`;
    durationLabel = `~${formatMinutesAsDuration(computeWindowDurationMinutes(conditions.freeAfter, conditions.freeBefore))} free window`;
  } else if (conditions.freeAfter) {
    headline = `Free after ${conditions.freeAfter}`;
  } else if (conditions.freeBefore) {
    headline = `Free before ${conditions.freeBefore}`;
  } else if (dayBadges.length) {
    headline = `Free on ${dayBadges.join(', ')}`;
  } else if (conditions.alwaysFree) {
    headline = 'Free';
  } else {
    headline = 'Conditions unclear — check signage';
  }

  return {
    headline,
    durationLabel,
    dayBadges,
    maxStayLabel,
    raw: conditions.notes ?? null,
  };
}
