export type AssumptionPromptResponseType = 'single_select' | 'multi_select' | 'text';
export type AssumptionSessionStatus =
  | 'in_progress'
  | 'awaiting_draft'
  | 'drafting'
  | 'blocked'
  | 'ready';

export interface AssumptionPromptOption {
  id: string;
  label: string;
  description: string | null;
  defaultSelected: boolean;
}

export type AssumptionAction = 'answer' | 'defer' | 'escalate' | 'skip_override';

export interface AssumptionPromptState {
  id: string;
  heading: string;
  body: string;
  responseType: AssumptionPromptResponseType;
  options: AssumptionPromptOption[];
  priority: number;
  status: 'pending' | 'answered' | 'deferred' | 'escalated' | 'override_skipped';
  answer: string | null;
  overrideJustification: string | null;
  unresolvedOverrideCount: number;
  escalation?: {
    assignedTo: string;
    status: 'pending' | 'resolved';
    notes?: string;
  };
}

export interface StartAssumptionSessionResponse {
  sessionId: string;
  sectionId: string;
  prompts: AssumptionPromptState[];
  overridesOpen: number;
  summaryMarkdown: string | null;
  documentDecisionSnapshotId: string | null;
}

export interface RespondToAssumptionRequest {
  action: AssumptionAction;
  answer?: string;
  notes?: string;
  overrideJustification?: string;
}

export interface CreateProposalRequest {
  source: 'ai_generate' | 'manual_submit';
  draftOverride?: string;
}

export interface AssumptionProposal {
  proposalId: string;
  proposalIndex: number;
  contentMarkdown: string;
  rationale: Array<{
    assumptionId: string;
    summary: string;
  }>;
  overridesOpen: number;
}

export interface AssumptionProposalsListResponse {
  sessionId: string;
  proposals: AssumptionProposal[];
}

export interface AssumptionSessionSnapshotSummary {
  sessionId: string;
  sectionId: string;
  documentId: string;
  status: AssumptionSessionStatus;
  unresolvedOverrideCount: number;
  answeredCount: number;
  deferredCount: number;
  escalatedCount: number;
  overrideCount: number;
  summaryMarkdown: string | null;
  templateVersion: string;
}
