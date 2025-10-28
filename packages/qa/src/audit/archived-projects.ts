export interface ArchivedProjectAuditRecord {
  projectId: string;
  archivedAt: string;
  reviewedAt: string;
  correctionRequired: boolean;
  correctionCategory?: string;
  notes?: string;
}

export interface EvaluateArchivedProjectsOptions {
  threshold?: number;
  minimumSampleSize?: number;
}

export interface ArchivedProjectSamplingResult {
  sampleSize: number;
  corrections: number;
  correctionRate: number;
  threshold: number;
  withinThreshold: boolean;
  projectsNeedingReview: string[];
  insufficientSample: boolean;
}

const DEFAULT_THRESHOLD = 0.05; // 5%
const DEFAULT_MIN_SAMPLE = 20;

const clampRate = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return Math.round(value * 10_000) / 10_000;
};

export function evaluateArchivedProjectCorrections(
  records: ArchivedProjectAuditRecord[],
  options: EvaluateArchivedProjectsOptions = {}
): ArchivedProjectSamplingResult {
  const sampleSize = Array.isArray(records) ? records.length : 0;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const minimumSampleSize = options.minimumSampleSize ?? DEFAULT_MIN_SAMPLE;

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      corrections: 0,
      correctionRate: 0,
      threshold,
      withinThreshold: true,
      projectsNeedingReview: [],
      insufficientSample: minimumSampleSize > 0,
    };
  }

  const corrections = records.filter(record => record.correctionRequired).length;
  const correctionRate = clampRate(corrections / sampleSize);
  const projectsNeedingReview = records
    .filter(record => record.correctionRequired)
    .map(record => record.projectId);

  return {
    sampleSize,
    corrections,
    correctionRate,
    threshold,
    withinThreshold: correctionRate <= threshold,
    projectsNeedingReview,
    insufficientSample: sampleSize < minimumSampleSize,
  };
}
