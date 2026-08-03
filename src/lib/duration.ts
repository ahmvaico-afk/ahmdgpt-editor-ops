export function minutesSecondsToDecimal(minutes: number, seconds: number): number {
  return minutes + seconds / 60;
}

export function decimalToMinutesSeconds(durationMinutes: number): { minutes: number; seconds: number } {
  const totalSeconds = Math.round(durationMinutes * 60);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

export function formatDuration(durationMinutes: number): string {
  const { minutes, seconds } = decimalToMinutesSeconds(durationMinutes);
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}
