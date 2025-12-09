export interface StatsResult {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

export function calculateStats(values: (number | null | undefined)[]): StatsResult {
  const validValues = values.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  
  if (validValues.length === 0) {
    return { count: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  }

  const count = validValues.length;
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  // Median
  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  // Min and Max
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);

  // Standard Deviation (sample)
  const squaredDiffs = validValues.map((val) => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / (count > 1 ? count - 1 : 1);
  const stdDev = Math.sqrt(avgSquaredDiff);

  return { count, mean, median, min, max, stdDev };
}
