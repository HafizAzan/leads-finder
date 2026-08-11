export function getRandomDelay(minDelay: number, maxDelay: number): number {
  const min = Math.max(0, Math.floor(minDelay));
  const max = Math.max(min, Math.floor(maxDelay));
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
