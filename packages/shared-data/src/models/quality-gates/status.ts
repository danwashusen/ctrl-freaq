export const QUALITY_GATE_STATUSES = ['Blocker', 'Warning', 'Pass', 'Neutral'] as const;

export type QualityGateStatus = (typeof QUALITY_GATE_STATUSES)[number];

const QUALITY_GATE_PRIORITY = new Map<QualityGateStatus, number>([
  ['Blocker', 3],
  ['Warning', 2],
  ['Pass', 1],
  ['Neutral', 0],
]);

const getPriority = (status: QualityGateStatus): number => QUALITY_GATE_PRIORITY.get(status) ?? 0;

export const DEFAULT_QUALITY_GATE_STATUS: QualityGateStatus = 'Neutral';

export function isQualityGateStatus(value: unknown): value is QualityGateStatus {
  return typeof value === 'string' && QUALITY_GATE_STATUSES.includes(value as QualityGateStatus);
}

export function compareQualityGateStatus(a: QualityGateStatus, b: QualityGateStatus): number {
  return getPriority(a) - getPriority(b);
}

export function maxQualityGateStatus(statuses: Iterable<QualityGateStatus>): QualityGateStatus {
  let highest: QualityGateStatus = DEFAULT_QUALITY_GATE_STATUS;

  for (const status of statuses) {
    if (getPriority(status) > getPriority(highest)) {
      highest = status;
    }
  }

  return highest;
}
