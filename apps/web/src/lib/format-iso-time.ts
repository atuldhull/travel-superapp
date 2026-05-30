/**
 * AE286 — pure HH:MM formatter from an ISO timestamp.
 *
 * Used by itinerary day cards + activity timeline for the
 * compact "10:30" time stamp under each entry. Matches local
 * timezone (NOT UTC); empty / unparseable input returns ''.
 */

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatIsoTime(input: string | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
