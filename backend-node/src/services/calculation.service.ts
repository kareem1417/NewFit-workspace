// src/services/calculation.service.ts

/**
 * 1. Calculate Z-Score (how far user's score is from mean)
 */
export const calculateZScore = (value: number, mean: number, stdDev: number, higherIsBetter: boolean = true): number => {
    if (stdDev === 0) return 0;
    // If higher is better (e.g. weight lifted), subtract mean from value
    // If lower is better (e.g. running time), reverse the calculation
    return higherIsBetter ? (value - mean) / stdDev : (mean - value) / stdDev;
};

/**
 * 2. Convert Z-Score to Percentile (0 to 100)
 */
export const calculatePercentile = (zScore: number): number => {
    const sign = zScore < 0 ? -1 : 1;
    const x = Math.abs(zScore) / Math.sqrt(2);
    const t = 1.0 / (1.0 + 0.3275911 * x);
    const erf = sign * (1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));

    const percentile = 0.5 * (1 + erf) * 100;
    return Math.round(percentile);
};

/**
 * 3. Calculate Punch Power based on exercise percentiles
 */
export const calculatePunchPower = (foundation: number, accelerator: number, transfer: number): number => {
    // 30% Foundation, 40% Accelerator, 30% Transfer
    const score = (foundation * 0.30) + (accelerator * 0.40) + (transfer * 0.30);
    return Number(score.toFixed(2));
};