// Countdown math for the phase timer (§4.3). The server only stores start + duration.

/** Seconds left in the phase; negative once it runs over. */
export function remainingSec(startedAt: number, durationSec: number, nowMs: number): number {
  return Math.ceil(durationSec - (nowMs - startedAt) / 1000);
}

/** "07:05" while running, "+01:23" in overtime. */
export function formatClock(sec: number): string {
  const abs = Math.abs(sec);
  const mmss = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return sec < 0 ? `+${mmss}` : mmss;
}

/** "0:04" style offsets for the agenda. */
export function formatOffset(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Offset between server and local clock from one round trip, assuming the server read its
 * clock halfway through. Add it to Date.now() to get server time.
 */
export function clockOffset(sentAt: number, serverNow: number, receivedAt: number): number {
  return serverNow - (sentAt + receivedAt) / 2;
}
