import { documentFixtureSchema, sectionFixtureSchema } from './types';
import type {
  DocumentFixture,
  SectionFixture,
  SectionReference,
  AssumptionSessionFixture,
} from './types';

const baseUpdatedAt = '2025-01-15T15:30:00.000Z';

const architectureAssumptionSession: AssumptionSessionFixture = {
  sessionId: 'assm-bal-001',
  policy: 'balanced',
  unresolvedCount: 2,
  questions: [
    {
      id: 'q-ai-governance',
      prompt: 'Have we documented escalation paths for AI-driven recommendations?',
      decision: 'Capture escalation path in governance section',
      status: 'open',
    },
    {
      id: 'q-auth-zero-trust',
      prompt: 'Does the zero-trust rollout cover legacy services?',
      decision: 'Pending security review sign-off',
      status: 'open',
    },
    {
      id: 'q-latency-slo',
      prompt: 'Are latency SLOs aligned with regional deployments?',
      decision: 'Updated in API gateway configuration',
      status: 'resolved',
    },
  ],
  transcript: [
    {
      speaker: 'assistant',
      content:
        'Assistant: Highlighting gaps in the governance controls. Recommend addressing escalation paths before sign-off.',
      timestamp: '2025-01-15T15:05:00.000Z',
    },
    {
      speaker: 'user',
      content:
        'User: Acknowledged. We will sync with compliance to include the escalation playbook.',
      timestamp: '2025-01-15T15:06:30.000Z',
    },
    {
      speaker: 'assistant',
      content:
        'Assistant: Ensure zero-trust migration covers legacy services. Marking as open until evidence is attached.',
      timestamp: '2025-01-15T15:07:10.000Z',
    },
    {
      speaker: 'system',
      content: 'System: Transcript locked for audit after policy review window closed.',
      timestamp: '2025-01-15T15:08:45.000Z',
    },
  ],
};

const apiGatewayAssumptionSession: AssumptionSessionFixture = {
  sessionId: 'assm-api-042',
  policy: 'conservative',
  unresolvedCount: 1,
  questions: [
    {
      id: 'q-request-id',
      prompt: 'Do all gateway responses return the request identifier?',
      decision: 'Pending logging middleware verification',
      status: 'open',
    },
    {
      id: 'q-rate-limits',
      prompt: 'Are rate limit thresholds configured per tenant?',
      decision: 'Security signed off on shared defaults',
      status: 'resolved',
    },
  ],
  transcript: [
    {
      speaker: 'assistant',
      content:
        'Assistant: Confirming gateway emits request IDs. Waiting on observability pipeline evidence.',
      timestamp: '2025-01-15T14:40:00.000Z',
    },
    {
      speaker: 'user',
      content:
        'User: We added a structured logger stub for fixture mode. Uploading sample traces shortly.',
      timestamp: '2025-01-15T14:41:12.000Z',
    },
    {
      speaker: 'assistant',
      content:
        'Assistant: Marking one item unresolved until trace evidence lands. Include auth messaging in summary.',
      timestamp: '2025-01-15T14:42:05.000Z',
    },
  ],
};

const overviewContent = `## CTRL FreaQ Architecture Overview\n\nThe CTRL FreaQ platform unifies research, planning, and execution with a library-first mindset.\n\n- Documented APIs for every integration point\n- Deterministic fixtures ensure QA parity\n- Playwright exercises deep-link navigation and assumption workflows`;

const overviewApprovedContent = `## CTRL FreaQ Architecture Overview\n\nThe CTRL FreaQ platform unifies research, planning, and execution with a library-first mindset.\n\n- Updated introduction copy for architecture overview.\n- Documented APIs for every integration point\n- Deterministic fixtures ensure QA parity\n- Playwright exercises deep-link navigation and assumption workflows`;

const overviewManualSaveAt = Date.parse('2025-01-15T15:28:45.000Z');
const overviewLastSavedAt = '2025-01-15T15:29:15.000Z';
const overviewDiffGeneratedAt = '2025-01-15T15:29:25.000Z';

const sectionFixtures: Record<string, SectionFixture> = {
  'sec-overview': sectionFixtureSchema.parse({
    id: 'sec-overview',
    title: 'Executive Overview',
    content: overviewContent,
    editable: true,
    lifecycleState: 'ready',
    assumptionSession: null,
    lastAuthoredBy: 'Morgan Lee',
    lastUpdatedAt: '2025-01-14T12:00:00.000Z',
    draft: {
      draftId: 'draft-sec-overview-004',
      draftVersion: 4,
      draftBaseVersion: 3,
      latestApprovedVersion: 3,
      conflictState: 'clean',
      conflictReason: null,
      summaryNote: 'Reviewed for architecture alignment.',
      lastSavedAt: overviewLastSavedAt,
      lastSavedBy: 'Morgan Lee',
      lastManualSaveAt: overviewManualSaveAt,
      formattingWarnings: [
        {
          id: 'warn-passive-voice',
          message: 'Prefer active voice in the introductory paragraph.',
          severity: 'warning',
          startOffset: 0,
          endOffset: 54,
          markType: 'sentence',
        },
      ],
      conflictLog: [
        {
          detectedAt: '2025-01-09T13:20:00.000Z',
          detectedDuring: 'save',
          previousApprovedVersion: 2,
          latestApprovedVersion: 3,
          resolvedBy: 'auto_rebase',
          resolutionNote: 'Rebased draft on latest approved copy.',
        },
      ],
      conflictSnapshot: {
        status: 'clean',
        latestApprovedVersion: 3,
        conflictReason: null,
        events: [],
      },
    },
    diff: {
      mode: 'unified',
      segments: [
        {
          type: 'context',
          content: '## CTRL FreaQ Architecture Overview',
          startLine: 1,
        },
        {
          type: 'removed',
          content: '- Documented APIs for every integration point',
          startLine: 4,
        },
        {
          type: 'added',
          content: '- Updated introduction copy for architecture overview.',
          startLine: 4,
        },
        {
          type: 'added',
          content: '- Documented APIs for every integration point',
          startLine: 5,
        },
        {
          type: 'unchanged',
          content: '- Deterministic fixtures ensure QA parity',
          startLine: 6,
        },
      ],
      metadata: {
        approvedVersion: 3,
        draftVersion: 4,
        generatedAt: overviewDiffGeneratedAt,
      },
    },
    review: {
      reviewId: 'review-sec-overview-001',
      status: 'pending',
      submittedAt: '2025-01-15T15:29:45.000Z',
      submittedBy: 'Morgan Lee',
      summaryNote: 'Align introduction with current architecture decisions.',
    },
    approval: {
      approvedVersion: 3,
      approvedAt: '2025-01-14T12:05:00.000Z',
      approvedBy: 'Morgan Lee',
      approvedContent: overviewApprovedContent,
      reviewerSummary: 'Reviewed for architecture alignment.',
    },
  }),
  'sec-api': sectionFixtureSchema.parse({
    id: 'sec-api',
    title: 'API Gateway & Contracts',
    content: `### Gateway Responsibilities\n\n1. Authenticate every request using Clerk issued tokens.\n2. Proxy document updates to queued processors for deterministic replay.\n3. Emit structured logs tagged with request identifiers.\n\n> Fixture mode keeps these notes static so Playwright can assert routing without backend dependencies.`,
    editable: true,
    lifecycleState: 'review',
    assumptionSession: apiGatewayAssumptionSession,
    lastAuthoredBy: 'Ibrahim Khan',
    lastUpdatedAt: '2025-01-15T14:45:00.000Z',
    draft: {
      draftId: 'draft-sec-api-002',
      draftVersion: 2,
      draftBaseVersion: 1,
      latestApprovedVersion: 1,
      conflictState: 'clean',
      conflictReason: null,
      summaryNote: 'Gateway contract ready for QA.',
      lastSavedAt: '2025-01-15T14:45:45.000Z',
      lastSavedBy: 'Ibrahim Khan',
      lastManualSaveAt: Date.parse('2025-01-15T14:45:30.000Z'),
      formattingWarnings: [],
    },
    review: {
      reviewId: 'review-sec-api-001',
      status: 'pending',
      submittedAt: '2025-01-15T14:46:10.000Z',
      submittedBy: 'Ibrahim Khan',
      summaryNote: 'Validate gateway contract schema updates.',
    },
  }),
  'sec-assumptions': sectionFixtureSchema.parse({
    id: 'sec-assumptions',
    title: 'Assumption Governance',
    content: `### Assumption Governance Playbook\n\n- Track unresolved assumption count in the conflict dialog badge.\n- Surface Clerk auth messaging whenever fixture mode is active.\n- Link transcripts directly in the modal for audit collection.\n\nThese fixtures guarantee the modal renders deterministic content for E2E tests.`,
    editable: true,
    lifecycleState: 'assumptions',
    assumptionSession: architectureAssumptionSession,
    lastAuthoredBy: 'Priya Narayanan',
    lastUpdatedAt: baseUpdatedAt,
    draft: {
      draftId: 'draft-sec-assumptions-003',
      draftVersion: 3,
      draftBaseVersion: 2,
      latestApprovedVersion: 2,
      conflictState: 'rebase_required',
      conflictReason: 'Updated governance requirements awaiting compliance review.',
      summaryNote: 'Governance transcript updates in progress.',
      lastSavedAt: '2025-01-15T15:05:15.000Z',
      lastSavedBy: 'Priya Narayanan',
      lastManualSaveAt: Date.parse('2025-01-15T15:04:48.000Z'),
      formattingWarnings: [],
      conflictLog: [
        {
          detectedAt: '2025-01-15T15:04:10.000Z',
          detectedDuring: 'save',
          previousApprovedVersion: 2,
          latestApprovedVersion: 3,
          resolvedBy: null,
          resolutionNote: 'Waiting for compliance sign-off.',
        },
      ],
      conflictSnapshot: {
        status: 'rebase_required',
        latestApprovedVersion: 3,
        conflictReason: 'Compliance pushed an updated baseline during drafting.',
        events: [],
      },
    },
  }),
  'sec-deployment': sectionFixtureSchema.parse({
    id: 'sec-deployment',
    title: 'Deployment Topology',
    content: `### Environment Matrix\n\n- **Edge**: Vercel global CDN for static assets.\n- **Core**: AWS ECS rolling deployments behind ALB.\n- **Observability**: Grafana dashboards consolidate traces.\n\nFixture mode mimics regional routing by keeping deterministic metadata.`,
    editable: false,
    lifecycleState: 'drafting',
    assumptionSession: null,
    lastAuthoredBy: 'Morgan Lee',
    lastUpdatedAt: '2025-01-12T09:20:00.000Z',
  }),
};

const tableOfContents: SectionReference[] = [
  {
    id: 'sec-overview',
    title: 'Executive Overview',
    state: 'ready',
    hasConflicts: false,
  },
  {
    id: 'sec-api',
    title: 'API Gateway & Contracts',
    state: 'review',
    hasConflicts: true,
  },
  {
    id: 'sec-assumptions',
    title: 'Assumption Governance',
    state: 'assumptions',
    hasConflicts: true,
  },
  {
    id: 'sec-deployment',
    title: 'Deployment Topology',
    state: 'drafting',
    hasConflicts: false,
  },
];

export const demoArchitectureDocument: DocumentFixture = documentFixtureSchema.parse({
  id: 'demo-architecture',
  title: 'CTRL FreaQ Architecture Reference',
  summary:
    'Reference architecture outlining gateway responsibilities, assumption governance, and deployment strategy.',
  tableOfContents,
  updatedAt: baseUpdatedAt,
  lifecycleStatus: 'review',
  sections: sectionFixtures,
});

export const demoArchitectureFixtures = {
  document: demoArchitectureDocument,
  sections: sectionFixtures,
};

export const demoFixtureIds = {
  documentId: demoArchitectureDocument.id,
  primarySectionId: 'sec-api',
  assumptionSectionId: 'sec-assumptions',
};
