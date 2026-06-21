"use strict";
// src/services/calculation.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePunchPower = exports.calculatePercentile = exports.calculateZScore = void 0;
/**
 * 1. Calculate Z-Score (how far user's score is from mean)
 */
const calculateZScore = (value, mean, stdDev, higherIsBetter = true) => {
    if (stdDev === 0)
        return 0;
    // If higher is better (e.g. weight lifted), subtract mean from value
    // If lower is better (e.g. running time), reverse the calculation
    return higherIsBetter ? (value - mean) / stdDev : (mean - value) / stdDev;
};
exports.calculateZScore = calculateZScore;
/**
 * 2. Convert Z-Score to Percentile (0 to 100)
 */
const calculatePercentile = (zScore) => {
    const sign = zScore < 0 ? -1 : 1;
    const x = Math.abs(zScore) / Math.sqrt(2);
    const t = 1.0 / (1.0 + 0.3275911 * x);
    const erf = sign * (1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
    const percentile = 0.5 * (1 + erf) * 100;
    return Math.round(percentile);
};
exports.calculatePercentile = calculatePercentile;
/**
 * 3. Calculate Punch Power based on exercise percentiles
 */
const calculatePunchPower = (foundation, accelerator, transfer) => {
    // 30% Foundation, 40% Accelerator, 30% Transfer
    const score = (foundation * 0.30) + (accelerator * 0.40) + (transfer * 0.30);
    return Number(score.toFixed(2));
};
exports.calculatePunchPower = calculatePunchPower;
