/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MotionAnalysis {
  id: string;
  motionDescription: string;
  gsdCode: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  tmu: number; // Time Measurement Unit
  confidenceScore?: number; // 0-100
}

export interface Cycle {
  cycleNumber: number;
  motions: MotionAnalysis[];
  totalTmu: number;
}

export interface AnalysisResult {
  cycles: Cycle[];
  averageCycleTime: number;
  totalSmv: number; // Standard Minute Value
}
