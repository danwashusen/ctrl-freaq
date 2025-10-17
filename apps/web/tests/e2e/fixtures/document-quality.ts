export type QualityStatus = 'Pass' | 'Warning' | 'Blocker' | 'Neutral';

export interface SectionQualityFixture {
  sectionId: string;
  title: string;
  status: QualityStatus;
  runId: string;
  triggeredBy: string;
  durationMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  source: 'auto' | 'manual' | 'dashboard';
  remediationState: 'pending' | 'in-progress' | 'resolved';
  rules: Array<{
    ruleId: string;
    title: string;
    severity: QualityStatus;
    guidance: string[];
    docLink?: string | null;
  }>;
}

export interface DocumentQualitySummaryFixture {
  documentId: string;
  statusCounts: {
    pass: number;
    warning: number;
    blocker: number;
    neutral: number;
  };
  blockerSections: string[];
  warningSections: string[];
  lastRunAt: string;
  triggeredBy: string;
  requestId: string;
  publishBlocked: boolean;
  coverageGaps: Array<{
    requirementId: string;
    reason: 'no-link' | 'blocker' | 'warning-override';
    linkedSections: string[];
  }>;
}

export interface TraceabilityGapFixture {
  requirementId: string;
  sectionId: string;
  title: string;
  preview: string;
  gateStatus: QualityStatus;
  coverageStatus: 'covered' | 'warning' | 'blocker' | 'orphaned';
  lastValidatedAt: string | null;
  validatedBy: string | null;
  notes?: string[];
  revisionId?: string;
  auditTrail?: Array<{
    eventId: string;
    type: 'link-created' | 'link-updated' | 'link-orphaned' | 'link-reassigned';
    timestamp: string;
    actorId: string;
    details?: Record<string, unknown> | null;
  }>;
}

const baseTimestamp = '2025-01-17T16:45:00.000Z';

export const qualityGateRequestIds = {
  sectionOverview: 'req-sec-overview-quality',
  sectionApiGateway: 'req-sec-api-quality',
  sectionAssumptions: 'req-sec-assumptions-quality',
  sectionDeployment: 'req-sec-deployment-quality',
  documentSummary: 'req-doc-quality-summary',
};

export const sectionQualityFixtures: SectionQualityFixture[] = [
  {
    sectionId: 'sec-overview',
    title: 'Executive Overview',
    status: 'Blocker',
    runId: 'run-sec-overview-001',
    triggeredBy: 'user-morgan',
    durationMs: 1432,
    lastRunAt: baseTimestamp,
    lastSuccessAt: null,
    source: 'auto',
    remediationState: 'pending',
    rules: [
      {
        ruleId: 'qa.overview.severity',
        title: 'Executive summary missing risk analysis',
        severity: 'Blocker',
        guidance: [
          'Add a risk mitigation bullet covering resiliency gaps.',
          'Reference the governance appendix for escalation policies.',
        ],
        docLink: 'https://ctrl-freaq.dev/policies/risk-governance',
      },
      {
        ruleId: 'qa.overview.telemetry',
        title: 'Telemetry narrative incomplete',
        severity: 'Warning',
        guidance: [
          'Include P95 telemetry targets for document SLA.',
          'Mention structured audit logging enhancements.',
        ],
        docLink: null,
      },
    ],
  },
  {
    sectionId: 'sec-api',
    title: 'API Gateway',
    status: 'Warning',
    runId: 'run-sec-api-002',
    triggeredBy: 'user-nova',
    durationMs: 1084,
    lastRunAt: baseTimestamp,
    lastSuccessAt: '2025-01-16T11:30:00.000Z',
    source: 'dashboard',
    remediationState: 'in-progress',
    rules: [
      {
        ruleId: 'qa.api.http-request-id',
        title: 'Missing requestId propagation in sample payload',
        severity: 'Warning',
        guidance: [
          'Update the cURL example to include the `X-Request-ID` header.',
          'Link to the telemetry troubleshooting guide for validation steps.',
        ],
        docLink: 'https://ctrl-freaq.dev/docs/telemetry/request-id',
      },
    ],
  },
  {
    sectionId: 'sec-assumptions',
    title: 'Assumptions & Governance',
    status: 'Pass',
    runId: 'run-sec-assumptions-005',
    triggeredBy: 'user-kai',
    durationMs: 823,
    lastRunAt: baseTimestamp,
    lastSuccessAt: baseTimestamp,
    source: 'manual',
    remediationState: 'resolved',
    rules: [
      {
        ruleId: 'qa.assumptions.gov-audit',
        title: 'Policy references up to date',
        severity: 'Pass',
        guidance: [],
      },
    ],
  },
  {
    sectionId: 'sec-deployment',
    title: 'Deployment Strategy',
    status: 'Neutral',
    runId: 'run-sec-deployment-001',
    triggeredBy: 'user-avery',
    durationMs: 0,
    lastRunAt: null,
    lastSuccessAt: null,
    source: 'auto',
    remediationState: 'pending',
    rules: [],
  },
];

export const documentQualitySummaryFixture: DocumentQualitySummaryFixture = {
  documentId: 'demo-architecture',
  statusCounts: {
    pass: 8,
    warning: 3,
    blocker: 1,
    neutral: 2,
  },
  blockerSections: ['sec-overview'],
  warningSections: ['sec-api'],
  lastRunAt: baseTimestamp,
  triggeredBy: 'user-nova',
  requestId: qualityGateRequestIds.documentSummary,
  publishBlocked: true,
  coverageGaps: [
    {
      requirementId: 'req-governance-escalation',
      reason: 'blocker',
      linkedSections: ['sec-overview'],
    },
    {
      requirementId: 'req-traceability-coverage',
      reason: 'no-link',
      linkedSections: [],
    },
  ],
};

export const traceabilityGapFixtures: TraceabilityGapFixture[] = [
  {
    requirementId: 'req-governance-escalation',
    sectionId: 'sec-overview',
    title: 'Escalation policy documented',
    preview: 'Document escalation paths for outages with executive contacts.',
    gateStatus: 'Blocker',
    coverageStatus: 'blocker',
    lastValidatedAt: baseTimestamp,
    validatedBy: 'user-morgan',
    notes: ['Blocked until executive overview adds mitigation summary.'],
    revisionId: 'rev-sec-overview-qa',
    auditTrail: [
      {
        eventId: 'evt-traceability-created',
        type: 'link-created',
        timestamp: baseTimestamp,
        actorId: 'user-nova',
        details: { sectionId: 'sec-overview' },
      },
    ],
  },
  {
    requirementId: 'req-traceability-coverage',
    sectionId: 'sec-compliance',
    title: 'Traceability coverage assigned',
    preview: 'Link each requirement to compliant sections before publishing.',
    gateStatus: 'Neutral',
    coverageStatus: 'orphaned',
    lastValidatedAt: null,
    validatedBy: null,
    notes: [],
    revisionId: 'rev-sec-compliance-qa',
    auditTrail: [],
  },
];
