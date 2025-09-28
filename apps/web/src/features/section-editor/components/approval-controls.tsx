import { useMemo, useState, type FC } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { SectionStatus } from '@/features/document-editor/types/section-view';

interface ApprovalDecisionPayload {
  decision: 'approve' | 'changes_requested';
  approvalNote: string;
}

export interface ApprovalControlsProps {
  sectionTitle: string;
  currentStatus: SectionStatus;
  reviewerSummary?: string | null;
  draftVersion?: number | null;
  approvedVersion?: number | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  onApprove?: (payload: ApprovalDecisionPayload) => void;
  onRequestChanges?: (payload: ApprovalDecisionPayload) => void;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  className?: string;
}

const statusIcon = (status: SectionStatus) => {
  switch (status) {
    case 'ready':
      return <CheckCircle2 className="h-4 w-4 text-emerald-800" aria-hidden="true" />;
    case 'review':
      return <ClipboardCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />;
    case 'drafting':
      return <FileWarning className="h-4 w-4 text-amber-600" aria-hidden="true" />;
    case 'assumptions':
      return <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />;
    default:
      return <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />;
  }
};

const statusLabel: Record<SectionStatus, string> = {
  idle: 'Idle',
  assumptions: 'Assumptions Pending',
  drafting: 'Drafting',
  review: 'Review Pending',
  ready: 'Approved',
};

const defaultSummary = 'Reviewer summary unavailable';

const normalizeApprovalNote = (note: string | null | undefined) => (note ?? '').trim();

export const ApprovalControls: FC<ApprovalControlsProps> = ({
  sectionTitle,
  currentStatus,
  reviewerSummary,
  draftVersion,
  approvedVersion,
  approvedBy,
  approvedAt,
  approvalNote,
  onApprove,
  onRequestChanges,
  isSubmitting = false,
  isDisabled = false,
  className,
}) => {
  const [decision, setDecision] = useState<'approve' | 'changes_requested'>('approve');
  const [note, setNote] = useState(() => normalizeApprovalNote(approvalNote));

  const canSubmitApproval = !isDisabled && !isSubmitting;

  const resolvedSummary = useMemo(() => {
    const summary = reviewerSummary?.trim();
    return summary && summary.length > 0 ? summary : defaultSummary;
  }, [reviewerSummary]);

  const approvedAtCopy = approvedAt ?? 'Awaiting approval';
  const approvedByCopy = approvedBy ?? 'Not yet approved';
  const approvalNoteCopy = normalizeApprovalNote(approvalNote ?? note);

  const handleConfirm = () => {
    const payload: ApprovalDecisionPayload = {
      decision,
      approvalNote: note.trim(),
    };

    if (decision === 'approve') {
      onApprove?.(payload);
    } else {
      onRequestChanges?.(payload);
    }
  };

  const confirmDisabled =
    isSubmitting ||
    isDisabled ||
    (decision === 'approve' && !onApprove) ||
    (decision === 'changes_requested' && !onRequestChanges);

  return (
    <Card
      className={cn(
        'flex w-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm',
        className
      )}
      data-testid="approval-panel"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Section approval
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{sectionTitle}</h2>
          </div>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            data-testid="section-status-chip"
          >
            {statusIcon(currentStatus)}
            {statusLabel[currentStatus] ?? currentStatus}
          </span>
        </div>
        <p className="text-sm text-slate-600" data-testid="review-summary-note">
          <span data-testid="latest-review-summary">{resolvedSummary}</span>
        </p>
      </header>

      <section className="space-y-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Approval decision"
        >
          <Button
            type="button"
            variant={decision === 'approve' ? 'default' : 'outline'}
            onClick={() => setDecision('approve')}
            data-testid="approval-decision-approve"
            disabled={isDisabled || isSubmitting}
          >
            Approve section
          </Button>
          <Button
            type="button"
            variant={decision === 'changes_requested' ? 'default' : 'outline'}
            onClick={() => setDecision('changes_requested')}
            data-testid="approval-decision-request-changes"
            disabled={isDisabled || isSubmitting}
          >
            Request changes
          </Button>
        </div>

        <label htmlFor="approval-note" className="text-sm font-medium text-slate-800">
          Approval note
        </label>
        <textarea
          id="approval-note"
          className="min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Capture reviewer rationale for the audit trail."
          value={note}
          onChange={event => setNote(event.target.value)}
          aria-required="true"
          data-testid="approval-note-input"
          disabled={isDisabled}
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Draft v{typeof draftVersion === 'number' ? draftVersion : '—'}</span>
          <span>Approved v{typeof approvedVersion === 'number' ? approvedVersion : '—'}</span>
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={handleConfirm}
          disabled={confirmDisabled}
          aria-busy={isSubmitting && canSubmitApproval}
          data-testid="confirm-approval"
          className="gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {decision === 'approve' ? 'Finalize approval' : 'Send back for revisions'}
        </Button>
        {decision === 'approve' && onRequestChanges && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDecision('changes_requested')}
            disabled={isSubmitting || isDisabled}
            className="gap-2"
            data-testid="switch-to-request-changes"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Request changes instead
          </Button>
        )}
      </footer>

      <section
        className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        data-testid="section-approval-audit"
      >
        <dl className="space-y-1">
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Approved by</dt>
            <dd data-testid="approved-by">{approvedByCopy}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Approved at</dt>
            <dd data-testid="approved-at">{approvedAtCopy}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium">Approval note</dt>
            <dd data-testid="approval-note" className="max-w-[320px] text-right">
              {approvalNoteCopy.length > 0 ? approvalNoteCopy : '—'}
            </dd>
          </div>
        </dl>
      </section>
    </Card>
  );
};

export default ApprovalControls;
