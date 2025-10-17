import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/shallow';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';

import { useEditorStore } from '../stores/editor-store';
import { useDocumentStore } from '../stores/document-store';
import { useSessionStore } from '../stores/session-store';
import { useDraftStateStore } from '../stores/draft-state';
import type { SectionView } from '../types/section-view';

import TableOfContentsComponent from './table-of-contents';
import DocumentSectionPreview from './document-section-preview';
import MilkdownEditor from './milkdown-editor';

import { ManualSavePanel } from '@/features/section-editor/components/manual-save-panel';
import type { DocumentFixture } from '@/lib/fixtures/e2e';
import { FormattingToolbar } from '@/features/section-editor/components/formatting-toolbar';
import { ConflictDialog } from '@/features/section-editor/components/conflict-dialog';
import { DiffViewer } from '@/features/section-editor/components/diff-viewer';
import { ApprovalControls } from '@/features/section-editor/components/approval-controls';
import {
  useSectionDraft,
  type FormattingAnnotation,
} from '@/features/section-editor/hooks/use-section-draft';
import { useSectionDraftStore } from '@/features/section-editor/stores/section-draft-store';
import { createSectionEditorClient } from '@/features/section-editor/api/section-editor.client';
import type {
  ConflictCheckResponseDTO,
  SectionDraftResponseDTO,
} from '@/features/section-editor/api/section-editor.mappers';
import {
  SectionEditorClientError,
  SectionEditorConflictError,
} from '@/features/section-editor/api/section-editor.client';
import { useDocumentFixtureBootstrap } from '../hooks/use-document-fixture';
import { AssumptionsChecklist } from '../assumptions-flow/components/assumptions-checklist';
import { useAssumptionsFlow } from '../assumptions-flow/hooks/use-assumptions-flow';
import { CoAuthorSidebar } from './co-authoring';
import { DocumentQaPanel } from './document-qa';
import { DocumentQualityDashboard } from '../quality-gates/components/DocumentQualityDashboard';
import { useDocumentQualityStore } from '../quality-gates/stores/document-quality-store';
import { useCoAuthorSession } from '../hooks/useCoAuthorSession';
import { useDocumentQaSession } from '../hooks/useDocumentQaSession';
import type { CoAuthoringIntent } from '../stores/co-authoring-store';

export interface DocumentEditorProps {
  documentId: string;
  initialSectionId?: string;
  fixtureDocument?: DocumentFixture;
  className?: string;
}

const sortSections = (sections: Record<string, SectionView>): SectionView[] =>
  Object.values(sections).sort((a, b) => a.orderIndex - b.orderIndex);

const logQualityGateAction = (message: string) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.info(message);
  }
};

const resolveSummaryForApproval = (
  section: SectionView,
  fallback: string | null
): string | null => {
  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }
  if (section.summaryNote && section.summaryNote.trim().length > 0) {
    return section.summaryNote;
  }
  if (section.lastSummary && section.lastSummary.trim().length > 0) {
    return section.lastSummary;
  }
  return null;
};

export const DocumentEditor = memo<DocumentEditorProps>(
  ({ documentId, className, initialSectionId, fixtureDocument }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [manualSaveError, setManualSaveError] = useState<string | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [approvalError, setApprovalError] = useState<string | null>(null);
    const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
    const [isApprovalSubmitting, setIsApprovalSubmitting] = useState(false);
    const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
    const [isResolvingConflict, setIsResolvingConflict] = useState(false);
    const [showQuotaBanner, setShowQuotaBanner] = useState(false);
    const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
    const [isRecoveryProcessing, setIsRecoveryProcessing] = useState(false);
    const [isCoAuthorOpen, setIsCoAuthorOpen] = useState(false);
    const [isDocumentQaOpen, setIsDocumentQaOpen] = useState(false);
    const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>(['knowledge:wcag']);
    const [selectedDecisionIds, setSelectedDecisionIds] = useState<string[]>([
      'decision:telemetry',
    ]);
    const editEntryTimerRef = useRef<(() => void) | null>(null);
    const editRenderTimerRef = useRef<(() => void) | null>(null);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const quotaHandler = (event: Event) => {
        const detail = (event as CustomEvent<{ message?: string }>).detail;
        setQuotaMessage(
          detail?.message ??
            'Browser storage limit reached. Oldest drafts removed to continue editing.'
        );
        setShowQuotaBanner(true);
      };

      const quotaClearedHandler = () => {
        setShowQuotaBanner(false);
        setQuotaMessage(null);
      };

      window.addEventListener('draft-storage:quota-exceeded', quotaHandler);
      window.addEventListener('draft-storage:quota-exhausted', quotaHandler);
      window.addEventListener('draft-storage:quota-cleared', quotaClearedHandler);

      return () => {
        window.removeEventListener('draft-storage:quota-exceeded', quotaHandler);
        window.removeEventListener('draft-storage:quota-exhausted', quotaHandler);
        window.removeEventListener('draft-storage:quota-cleared', quotaClearedHandler);
      };
    }, []);

    useDocumentFixtureBootstrap({
      documentId,
      fixtureDocument,
      initialSectionId,
    });

    const {
      sections,
      activeSectionId,
      isEditing,
      showDiffView,
      pendingChangesCount,
      setActiveSection,
      enterEditMode,
      cancelEditing,
      updateSection,
      toggleDiffView,
      setDiffView,
      setDraftMetadata,
      setConflictState,
      recordManualSave,
      setApprovalMetadata,
    } = useEditorStore(
      useShallow(state => ({
        sections: state.sections,
        activeSectionId: state.activeSectionId,
        isEditing: state.isEditing,
        showDiffView: state.showDiffView,
        pendingChangesCount: state.pendingChangesCount,
        setActiveSection: state.setActiveSection,
        enterEditMode: state.enterEditMode,
        cancelEditing: state.cancelEditing,
        updateSection: state.updateSection,
        toggleDiffView: state.toggleDiffView,
        setDiffView: state.setDiffView,
        setDraftMetadata: state.setDraftMetadata,
        setConflictState: state.setConflictState,
        recordManualSave: state.recordManualSave,
        setApprovalMetadata: state.setApprovalMetadata,
      }))
    );

    const {
      toc,
      setTableOfContents,
      getAssumptionSession,
      document: documentInfo,
    } = useDocumentStore(
      useShallow(state => ({
        toc: state.toc,
        setTableOfContents: state.setTableOfContents,
        getAssumptionSession: state.getAssumptionSession,
        document: state.document,
      }))
    );

    const projectSlug = documentInfo?.projectSlug ?? fixtureDocument?.projectSlug ?? 'project-test';

    const { updateScrollPosition, setActiveSection: setSessionActiveSection } = useSessionStore(
      useShallow(state => ({
        updateScrollPosition: state.updateScrollPosition,
        setActiveSection: state.setActiveSection,
      }))
    );
    const session = useSessionStore(state => state.session);
    const rehydratedDrafts = useDraftStateStore(state => state.rehydratedDrafts);
    const isE2EMode = import.meta.env.VITE_E2E === 'true';

    const pendingRehydratedDrafts = useMemo(() => {
      if (isE2EMode) {
        return [];
      }
      return Object.values(rehydratedDrafts).filter(draft => draft.status === 'pending');
    }, [isE2EMode, rehydratedDrafts]);
    const hasPendingRehydrations = pendingRehydratedDrafts.length > 0;

    const applyRecoveredDrafts = useCallback(async () => {
      if (!pendingRehydratedDrafts.length) {
        return;
      }
      setIsRecoveryProcessing(true);
      try {
        await Promise.all(
          pendingRehydratedDrafts.map(async draft => {
            if (typeof draft.confirm === 'function') {
              await draft.confirm();
            }
          })
        );
      } catch (error) {
        logger.error(
          {
            operation: 'draft_recovery_apply',
            reason: error instanceof Error ? error.message : String(error),
          },
          'Failed to apply recovered drafts'
        );
      } finally {
        setIsRecoveryProcessing(false);
      }
    }, [pendingRehydratedDrafts]);

    const discardRecoveredDrafts = useCallback(async () => {
      if (!pendingRehydratedDrafts.length) {
        return;
      }
      setIsRecoveryProcessing(true);
      try {
        await Promise.all(
          pendingRehydratedDrafts.map(async draft => {
            if (typeof draft.discard === 'function') {
              await draft.discard();
            }
          })
        );
      } catch (error) {
        logger.error(
          {
            operation: 'draft_recovery_discard',
            reason: error instanceof Error ? error.message : String(error),
          },
          'Failed to discard recovered drafts'
        );
      } finally {
        setIsRecoveryProcessing(false);
      }
    }, [pendingRehydratedDrafts]);

    const client = useMemo(() => {
      const baseUrl =
        fixtureDocument && typeof window !== 'undefined'
          ? `${window.location.origin.replace(/\/$/, '')}/__fixtures/api`
          : undefined;
      return createSectionEditorClient(baseUrl ? { baseUrl } : undefined);
    }, [fixtureDocument]);

    const sectionsList = useMemo(() => sortSections(sections), [sections]);
    const activeSection = activeSectionId ? (sections[activeSectionId] ?? null) : null;

    const knowledgeOptions = useMemo(
      () => [
        { id: 'knowledge:wcag', label: 'WCAG accessibility guidelines' },
        { id: 'knowledge:streaming', label: 'Streaming progress best practices' },
      ],
      []
    );

    const decisionOptions = useMemo(
      () => [
        { id: 'decision:telemetry', label: 'Telemetry stays console-only' },
        { id: 'decision:audit', label: 'Changelog captures approval metadata' },
      ],
      []
    );

    const toggleKnowledge = useCallback((id: string) => {
      setSelectedKnowledgeIds(prev =>
        prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]
      );
    }, []);

    const toggleDecision = useCallback((id: string) => {
      setSelectedDecisionIds(prev =>
        prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]
      );
    }, []);

    const contextSources = useMemo(
      () => [...new Set([...selectedKnowledgeIds, ...selectedDecisionIds])],
      [selectedKnowledgeIds, selectedDecisionIds]
    );

    const shouldEnableAssumptionsFlow =
      activeSection?.status === 'assumptions' ||
      (!!activeSection && !activeSection.hasContent && !activeSection.assumptionsResolved);

    const {
      state: assumptionFlowState,
      isLoading: isAssumptionFlowLoading,
      error: assumptionFlowError,
      respond: respondToAssumptionPrompt,
      streaming: assumptionStreaming,
    } = useAssumptionsFlow({
      sectionId: shouldEnableAssumptionsFlow ? activeSection?.id : undefined,
      documentId,
      templateVersion: '1.0.0',
      enabled: shouldEnableAssumptionsFlow,
    });

    const assumptionSessionFromStore = activeSection
      ? getAssumptionSession(activeSection.id)
      : null;
    const activeAssumptionSession = assumptionFlowState ?? assumptionSessionFromStore;
    const assumptionFlowBlocking = Boolean(
      shouldEnableAssumptionsFlow &&
        (assumptionFlowState?.promptsRemaining ?? 0) + (assumptionFlowState?.overridesOpen ?? 0) > 0
    );

    const sectionDraftState = useSectionDraftStore(
      useShallow(state => ({
        conflictReason: state.conflictReason,
        latestApprovedVersion: state.latestApprovedVersion,
        conflictEvents: state.conflictEvents,
        rebasedDraft: state.rebasedDraft,
        draftId: state.draftId,
        draftVersion: state.draftVersion,
        draftBaseVersion: state.draftBaseVersion,
        lastSavedAt: state.lastSavedAt,
        lastSavedBy: state.lastSavedBy,
        lastManualSaveAt: state.lastManualSaveAt,
        serverSnapshots: state.serverSnapshots,
        setFormattingAnnotations: state.setFormattingAnnotations,
      }))
    );
    const recordConflictEvents = useSectionDraftStore(state => state.recordConflictEvents);

    const sectionEditorApi = useMemo(
      () => ({
        saveDraft: (payload: { sectionId: string } & Parameters<typeof client.saveDraft>[1]) =>
          client.saveDraft(payload.sectionId, payload),
        checkConflicts: (
          payload: { sectionId: string } & Parameters<typeof client.checkConflicts>[1]
        ) => client.checkConflicts(payload.sectionId, payload),
        fetchDiff: (payload: { sectionId: string }) => client.getDiff(payload.sectionId),
        listConflictLogs: (payload: { sectionId: string }) =>
          client.listConflictLogs(payload.sectionId),
      }),
      [client]
    );

    const effectiveUserId = fixtureDocument
      ? 'user-local-author'
      : (session?.userId ?? 'user-local-author');

    const {
      state: draftState,
      updateDraft,
      setSummary,
      manualSave,
      refreshDiff,
      resolveConflicts,
    } = useSectionDraft({
      api: sectionEditorApi,
      sectionId: activeSection?.id ?? `inactive-${documentId}`,
      initialContent: activeSection?.contentMarkdown ?? '',
      approvedVersion: activeSection?.approvedVersion ?? 0,
      documentId,
      documentSlug: documentId,
      userId: effectiveUserId,
      projectSlug,
      sectionTitle: activeSection?.title ?? 'Untitled section',
      sectionPath: activeSection?.id ?? `inactive-${documentId}`,
      initialSummaryNote: activeSection?.summaryNote ?? activeSection?.lastSummary ?? '',
      initialConflictState: activeSection?.conflictState,
      initialDraftId: activeSection?.draftId,
      initialDraftVersion: activeSection?.draftVersion,
      loadPersistedDraft: Boolean(activeSection),
    });

    const coAuthor = useCoAuthorSession({
      documentId,
      sectionId: activeSectionId ?? null,
      authorId: effectiveUserId,
    });

    const documentQa = useDocumentQaSession({
      documentId,
      sectionId: activeSectionId ?? null,
      reviewerId: effectiveUserId,
    });

    const {
      session: coAuthorSessionState,
      progress: coAuthorProgress,
      transcript: coAuthorTranscript,
      pendingProposal: coAuthorPendingProposal,
      fallback: coAuthorFallback,
      replacementNotice: coAuthorReplacementNotice,
      analyze: analyzeWithCoAuthor,
      requestProposal: requestCoAuthorProposal,
      approveProposal: approveCoAuthorProposal,
      cancelStreaming: cancelCoAuthorStreaming,
      teardown: teardownCoAuthor,
      setIntent: setCoAuthorIntent,
      setContextSources: setCoAuthorContextSources,
      ensureSession: ensureCoAuthorSession,
      clearFallback: clearCoAuthorFallback,
      pushFallback: pushCoAuthorFallback,
      dismissProposal: dismissCoAuthorProposal,
    } = coAuthor;

    const {
      progress: documentQaProgress,
      transcript: documentQaTranscript,
      replacementNotice: documentQaReplacementNotice,
      ensureSession: ensureDocumentQaSession,
      cancelStreaming: cancelDocumentQaStreaming,
      teardown: teardownDocumentQa,
    } = documentQa;

    useEffect(() => {
      if (!coAuthorSessionState) {
        return;
      }

      const nextSources = Array.from(new Set(contextSources)).sort();
      const currentSources = Array.from(new Set(coAuthorSessionState.contextSources)).sort();
      const unchanged =
        nextSources.length === currentSources.length &&
        nextSources.every((value, index) => value === currentSources[index]);

      if (unchanged) {
        return;
      }

      setCoAuthorContextSources(nextSources);
    }, [coAuthorSessionState, contextSources, setCoAuthorContextSources]);

    useEffect(() => {
      if (!isDocumentQaOpen) {
        return;
      }
      void ensureDocumentQaSession();
    }, [ensureDocumentQaSession, isDocumentQaOpen, activeSectionId]);

    useEffect(() => {
      if (!isDocumentQaOpen) {
        return;
      }
      return () => {
        teardownDocumentQa();
      };
    }, [isDocumentQaOpen, teardownDocumentQa]);

    const completedSections = useMemo(() => {
      return sectionsList
        .filter(section => section.hasContent)
        .map(section => ({
          path: `/documents/${documentId}/sections/${section.key ?? section.id}.md`,
          content: section.contentMarkdown,
        }));
    }, [documentId, sectionsList]);

    const currentDraftContent = useMemo(() => {
      if (draftState.content && draftState.content.length > 0) {
        return draftState.content;
      }
      return activeSection?.contentMarkdown ?? '';
    }, [draftState.content, activeSection]);

    const draftVersion = sectionDraftState.draftVersion ?? activeSection?.draftVersion ?? undefined;
    const baselineVersionCandidate =
      sectionDraftState.draftBaseVersion ?? activeSection?.draftBaseVersion ?? null;
    const baselineVersion =
      baselineVersionCandidate === null || baselineVersionCandidate === undefined
        ? undefined
        : typeof baselineVersionCandidate === 'string'
          ? baselineVersionCandidate
          : `rev-${baselineVersionCandidate}`;

    const approvalSummary = resolveSummaryForApproval(
      activeSection ?? ({} as SectionView),
      draftState.summaryNote
    );

    const activeCoAuthorIntent: CoAuthoringIntent = coAuthorSessionState?.activeIntent ?? 'improve';
    const documentTitle = documentInfo?.title ?? fixtureDocument?.title ?? 'Untitled document';

    const {
      publishCopy: documentPublishCopy,
      slaWarningCopy: documentSlaWarningCopy,
      isPublishBlocked: isDocumentPublishBlocked,
      status: documentValidationStatus,
    } = useDocumentQualityStore(state => ({
      publishCopy: state.publishCopy,
      slaWarningCopy: state.slaWarningCopy,
      isPublishBlocked: state.isPublishBlocked,
      status: state.status,
    }));
    const isDocumentRunning = documentValidationStatus === 'running';

    const handleToggleCoAuthor = useCallback(() => {
      setIsCoAuthorOpen(prev => {
        const next = !prev;
        if (next) {
          ensureCoAuthorSession({ intent: activeCoAuthorIntent, contextSources });
        } else {
          cancelCoAuthorStreaming();
          dismissCoAuthorProposal();
          clearCoAuthorFallback();
        }
        return next;
      });
    }, [
      activeCoAuthorIntent,
      cancelCoAuthorStreaming,
      clearCoAuthorFallback,
      contextSources,
      dismissCoAuthorProposal,
      ensureCoAuthorSession,
    ]);

    const handleIntentChange = useCallback(
      (intent: CoAuthoringIntent) => {
        setCoAuthorIntent(intent);
        ensureCoAuthorSession({ intent, contextSources });
      },
      [contextSources, ensureCoAuthorSession, setCoAuthorIntent]
    );

    const handleAnalyzeRequest = useCallback(
      async ({ intent, prompt }: { intent: CoAuthoringIntent; prompt: string }) => {
        clearCoAuthorFallback();
        try {
          ensureCoAuthorSession({ intent, contextSources });
          await analyzeWithCoAuthor({
            intent,
            prompt,
            knowledgeItemIds: selectedKnowledgeIds,
            decisionIds: selectedDecisionIds,
            completedSections,
            currentDraft: currentDraftContent,
            contextSources,
          });
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'Co-author analyze request failed'
          );
          pushCoAuthorFallback('assistant_unavailable', true);
        }
      },
      [
        analyzeWithCoAuthor,
        clearCoAuthorFallback,
        completedSections,
        currentDraftContent,
        ensureCoAuthorSession,
        pushCoAuthorFallback,
        selectedDecisionIds,
        selectedKnowledgeIds,
        contextSources,
      ]
    );

    const handleProposalRequest = useCallback(
      async ({ intent, prompt }: { intent: CoAuthoringIntent; prompt: string }) => {
        clearCoAuthorFallback();
        try {
          ensureCoAuthorSession({ intent, contextSources });
          await requestCoAuthorProposal({
            intent,
            prompt,
            knowledgeItemIds: selectedKnowledgeIds,
            decisionIds: selectedDecisionIds,
            completedSections,
            currentDraft: currentDraftContent,
            draftVersion,
            baselineVersion,
            contextSources,
          });
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            'Co-author proposal request failed'
          );
          pushCoAuthorFallback('assistant_unavailable', true);
        }
      },
      [
        baselineVersion,
        clearCoAuthorFallback,
        completedSections,
        currentDraftContent,
        draftVersion,
        ensureCoAuthorSession,
        pushCoAuthorFallback,
        requestCoAuthorProposal,
        selectedDecisionIds,
        selectedKnowledgeIds,
        contextSources,
      ]
    );

    const handleApproveProposal = useCallback(async () => {
      if (!coAuthorPendingProposal) {
        return;
      }
      try {
        await approveCoAuthorProposal({
          proposalId: coAuthorPendingProposal.proposalId,
          draftPatch: coAuthorPendingProposal.draftPatch ?? 'diff --git a/section.md b/section.md',
          diffHash: coAuthorPendingProposal.diffHash,
          approvalNotes: approvalSummary ?? undefined,
          draftVersion,
        });
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Failed to approve co-author proposal'
        );
        pushCoAuthorFallback('approval_failed', true);
      }
    }, [
      approveCoAuthorProposal,
      approvalSummary,
      coAuthorPendingProposal,
      draftVersion,
      pushCoAuthorFallback,
    ]);

    const handleRejectProposal = useCallback(() => {
      dismissCoAuthorProposal();
      cancelCoAuthorStreaming();
    }, [cancelCoAuthorStreaming, dismissCoAuthorProposal]);

    const handleCoAuthorRequestChanges = useCallback(() => {
      dismissCoAuthorProposal();
      pushCoAuthorFallback('proposal_needs_changes', false);
    }, [dismissCoAuthorProposal, pushCoAuthorFallback]);

    const handleRetryAssistant = useCallback(() => {
      clearCoAuthorFallback();
      cancelCoAuthorStreaming();
    }, [cancelCoAuthorStreaming, clearCoAuthorFallback]);

    useEffect(() => {
      if (!isCoAuthorOpen) {
        return;
      }
      ensureCoAuthorSession({ intent: activeCoAuthorIntent, contextSources });
    }, [activeCoAuthorIntent, contextSources, ensureCoAuthorSession, isCoAuthorOpen]);

    const previousSectionIdRef = useRef<string | null>(null);
    useEffect(() => {
      if (
        previousSectionIdRef.current &&
        previousSectionIdRef.current !== (activeSectionId ?? null)
      ) {
        teardownCoAuthor('section-change');
        dismissCoAuthorProposal();
        clearCoAuthorFallback();
      }
      previousSectionIdRef.current = activeSectionId ?? null;
    }, [activeSectionId, clearCoAuthorFallback, dismissCoAuthorProposal, teardownCoAuthor]);

    const teardownRef = useRef(teardownCoAuthor);
    useEffect(() => {
      teardownRef.current = teardownCoAuthor;
    }, [teardownCoAuthor]);

    useEffect(() => {
      return () => {
        teardownRef.current('navigation');
      };
    }, []);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }
      const handleStreamError = () => pushCoAuthorFallback('assistant_unavailable', true);
      window.addEventListener('coauthor:stream-error', handleStreamError);
      return () => {
        window.removeEventListener('coauthor:stream-error', handleStreamError);
      };
    }, [pushCoAuthorFallback]);

    const telemetrySectionId = activeSection?.id ?? null;
    const telemetryContentLength = activeSection?.contentMarkdown?.length ?? 0;

    useEffect(() => {
      if (!fixtureDocument || !activeSection) {
        return;
      }

      const fixtureSection = fixtureDocument.sections?.[activeSection.id];
      const conflictLog = fixtureSection?.draft?.conflictLog;
      if (conflictLog && conflictLog.length > 0) {
        recordConflictEvents(conflictLog.map(entry => ({ ...entry })));
      }
    }, [fixtureDocument, activeSection, recordConflictEvents]);

    useEffect(() => {
      if (!activeSection) {
        return;
      }

      const desiredViewState = isEditing ? 'edit_mode' : 'read_mode';
      if (activeSection.viewState !== desiredViewState) {
        updateSection({ id: activeSection.id, viewState: desiredViewState });
      }
    }, [activeSection, isEditing, updateSection]);

    useEffect(() => {
      if (!activeSection) {
        return;
      }

      const nextDraftId = sectionDraftState.draftId ?? null;
      const nextDraftVersion = sectionDraftState.draftVersion ?? null;
      const nextDraftBaseVersion = sectionDraftState.draftBaseVersion ?? null;
      const nextLatestApprovedVersion = sectionDraftState.latestApprovedVersion ?? null;

      const hasDraftMetadataChanged =
        activeSection.draftId !== nextDraftId ||
        activeSection.draftVersion !== nextDraftVersion ||
        activeSection.draftBaseVersion !== nextDraftBaseVersion ||
        activeSection.latestApprovedVersion !== nextLatestApprovedVersion;

      if (!hasDraftMetadataChanged) {
        return;
      }

      setDraftMetadata(activeSection.id, {
        draftId: nextDraftId,
        draftVersion: nextDraftVersion,
        draftBaseVersion: nextDraftBaseVersion,
        latestApprovedVersion: nextLatestApprovedVersion,
      });
    }, [
      activeSection,
      sectionDraftState.draftId,
      sectionDraftState.draftVersion,
      sectionDraftState.draftBaseVersion,
      sectionDraftState.latestApprovedVersion,
      setDraftMetadata,
    ]);

    useEffect(() => {
      if (!activeSection) {
        return;
      }

      const nextConflictState = draftState.conflictState;
      const nextConflictReason = sectionDraftState.conflictReason ?? null;
      const nextLatestApprovedVersion = sectionDraftState.latestApprovedVersion ?? null;

      const hasConflictStateChanged =
        activeSection.conflictState !== nextConflictState ||
        activeSection.conflictReason !== nextConflictReason ||
        activeSection.latestApprovedVersion !== nextLatestApprovedVersion;

      if (hasConflictStateChanged) {
        setConflictState(activeSection.id, {
          conflictState: nextConflictState,
          conflictReason: nextConflictReason,
          latestApprovedVersion: nextLatestApprovedVersion,
        });
      }

      if (
        draftState.conflictState === 'rebase_required' ||
        draftState.conflictState === 'blocked'
      ) {
        setIsConflictDialogOpen(true);
      }

      if (draftState.conflictState === 'clean') {
        setIsConflictDialogOpen(false);
      }
    }, [
      activeSection,
      draftState.conflictState,
      sectionDraftState.conflictReason,
      sectionDraftState.latestApprovedVersion,
      setConflictState,
    ]);

    useEffect(() => {
      if (!activeSection) {
        return;
      }

      const nextLastSavedAt = sectionDraftState.lastSavedAt ?? null;
      const nextLastSavedBy = sectionDraftState.lastSavedBy ?? null;
      const nextLastManualSaveAt = sectionDraftState.lastManualSaveAt ?? null;
      const nextSummaryNote = draftState.summaryNote ?? null;

      const hasManualSaveMetadataChanged =
        activeSection.lastSavedAt !== nextLastSavedAt ||
        activeSection.lastSavedBy !== nextLastSavedBy ||
        activeSection.lastManualSaveAt !== nextLastManualSaveAt ||
        activeSection.summaryNote !== nextSummaryNote;

      if (!hasManualSaveMetadataChanged) {
        return;
      }

      recordManualSave(activeSection.id, {
        lastSavedAt: nextLastSavedAt,
        lastSavedBy: nextLastSavedBy,
        lastManualSaveAt: nextLastManualSaveAt,
        summaryNote: nextSummaryNote,
      });
    }, [
      activeSection,
      sectionDraftState.lastSavedAt,
      sectionDraftState.lastSavedBy,
      sectionDraftState.lastManualSaveAt,
      draftState.summaryNote,
      recordManualSave,
    ]);

    useEffect(() => {
      if (fixtureDocument || !sectionsList.length || (toc && toc.sections.length > 0)) {
        return;
      }

      try {
        const tocSections = sectionsList.map(section => ({
          sectionId: section.id,
          title: section.title,
          depth: section.depth,
          orderIndex: section.orderIndex,
          hasContent: section.hasContent,
          status: section.status,
          isExpanded: false,
          isActive: section.id === activeSectionId,
          isVisible: section.id === activeSectionId,
          hasUnsavedChanges: false,
          children: [],
          parentId: section.parentSectionId,
        }));

        setTableOfContents({
          documentId,
          sections: tocSections,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Failed to load document';
        logger.error(
          { operation: 'document_load', documentId, error: reason },
          'Failed to load document'
        );
      }
    }, [documentId, sectionsList, activeSectionId, setTableOfContents, toc, fixtureDocument]);

    const handleSectionClick = useCallback(
      (sectionId: string) => {
        setActiveSection(sectionId);
        setSessionActiveSection(sectionId);

        const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionElement) {
          sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      [setActiveSection, setSessionActiveSection]
    );

    const handleEnterEdit = useCallback(
      (sectionId: string) => {
        editEntryTimerRef.current = performanceMonitor.startNavigation();
        editRenderTimerRef.current = performanceMonitor.startRender();
        enterEditMode(sectionId);
        setActiveSection(sectionId);
        setSessionActiveSection(sectionId);
        setManualSaveError(null);
        setReviewError(null);
        setApprovalError(null);
      },
      [enterEditMode, setActiveSection, setSessionActiveSection]
    );

    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        updateScrollPosition((event.target as HTMLElement).scrollTop);
      },
      [updateScrollPosition]
    );

    const handleContentChange = useCallback(
      (markdown: string) => {
        updateDraft(markdown);
        if (activeSection) {
          updateSection({ id: activeSection.id, status: 'drafting' });
        }
      },
      [activeSection, updateDraft, updateSection]
    );

    const handleFormattingAnnotationsChange = useCallback(
      (annotations: FormattingAnnotation[]) => {
        sectionDraftState.setFormattingAnnotations(annotations);
      },
      [sectionDraftState]
    );

    const handleSummaryChange = useCallback(
      (summary: string) => {
        setSummary(summary);
        if (activeSection) {
          updateSection({ id: activeSection.id, summaryNote: summary });
        }
      },
      [activeSection, setSummary, updateSection]
    );

    const handleManualSave = useCallback(async () => {
      if (!activeSection) {
        return;
      }

      setManualSaveError(null);

      try {
        const result = (await manualSave()) as
          | SectionDraftResponseDTO
          | ConflictCheckResponseDTO
          | null;

        if (!result) {
          return;
        }

        const shouldSetFixtureMarkers = Boolean(fixtureDocument && activeSection);

        if (shouldSetFixtureMarkers && typeof window !== 'undefined') {
          const markerSectionTitle = activeSection.title ?? activeSection.id;
          const markerKey = `${projectSlug}/${documentId}/${markerSectionTitle}/${effectiveUserId}`;

          try {
            window.localStorage?.setItem(
              `draft-store:cleared:${markerKey}`,
              new Date().toISOString()
            );
          } catch (error) {
            void error;
          }

          try {
            window.sessionStorage?.setItem(
              `draft-store:recent-clean:${markerKey}`,
              Date.now().toString()
            );
          } catch (error) {
            void error;
          }
        }

        if ('draftId' in result) {
          setDraftMetadata(activeSection.id, {
            draftId: result.draftId,
            draftVersion: result.draftVersion,
            draftBaseVersion:
              result.conflictState === 'clean'
                ? result.draftVersion
                : sectionDraftState.draftBaseVersion,
            latestApprovedVersion: sectionDraftState.latestApprovedVersion,
          });

          recordManualSave(activeSection.id, {
            lastSavedAt: result.savedAt ?? null,
            lastSavedBy: result.savedBy ?? null,
            lastManualSaveAt: Date.now(),
            summaryNote: result.summaryNote ?? draftState.summaryNote ?? null,
          });

          updateSection({ id: activeSection.id, status: 'drafting' });
          return;
        }

        setIsConflictDialogOpen(true);
      } catch (error) {
        if (error instanceof SectionEditorConflictError) {
          setIsConflictDialogOpen(true);
          return;
        }

        const message =
          error instanceof SectionEditorClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Failed to save draft';
        setManualSaveError(message);
      }
    }, [
      activeSection,
      manualSave,
      setDraftMetadata,
      recordManualSave,
      draftState.summaryNote,
      sectionDraftState.draftBaseVersion,
      sectionDraftState.latestApprovedVersion,
      updateSection,
      fixtureDocument,
      projectSlug,
      documentId,
      effectiveUserId,
    ]);

    useEffect(() => {
      if (!isEditing) {
        return;
      }

      if (editEntryTimerRef.current) {
        editEntryTimerRef.current();
        editEntryTimerRef.current = null;
      }

      if (typeof window !== 'undefined' && editRenderTimerRef.current) {
        const finishRender = editRenderTimerRef.current;
        editRenderTimerRef.current = null;
        window.requestAnimationFrame(() => {
          finishRender();
        });
      }
    }, [isEditing]);

    useEffect(() => {
      if (typeof window === 'undefined' || !telemetrySectionId) {
        return;
      }

      const contentLength = telemetryContentLength;
      const LONG_SECTION_THRESHOLD = 50_000;

      if (contentLength < LONG_SECTION_THRESHOLD) {
        return;
      }

      let frames = 0;
      const start = performance.now();
      let rafId = 0;
      let cancelled = false;

      const measure = (timestamp: number) => {
        if (cancelled) {
          return;
        }

        frames += 1;
        const elapsed = timestamp - start;

        if (elapsed >= 1000) {
          const fps = (frames / elapsed) * 1000;
          const payload = {
            operation: 'long_section_performance',
            sectionId: telemetrySectionId,
            fps: Number(fps.toFixed(2)),
            threshold: 60,
            contentLength,
          } as const;

          if (fps >= 60) {
            logger.info(payload, 'Long section rendering meets 60fps target');
          } else {
            logger.warn(payload, 'Long section rendering fell below 60fps target');
          }

          return;
        }

        rafId = window.requestAnimationFrame(measure);
      };

      rafId = window.requestAnimationFrame(measure);

      return () => {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
      };
    }, [telemetrySectionId, telemetryContentLength]);

    const handleOpenDiff = useCallback(async () => {
      if (!activeSection) {
        return;
      }

      try {
        await refreshDiff();
      } catch (error) {
        logger.error(
          {
            sectionId: activeSection.id,
            reason: error instanceof Error ? error.message : String(error),
          },
          'Failed to refresh diff before opening viewer'
        );
      }

      toggleDiffView(true);
      setDiffView(true);
    }, [activeSection, refreshDiff, toggleDiffView, setDiffView]);

    const handleCloseDiff = useCallback(() => {
      toggleDiffView(false);
      setDiffView(false);
    }, [toggleDiffView, setDiffView]);

    const handleResolveConflicts = useCallback(async () => {
      setIsResolvingConflict(true);
      try {
        await resolveConflicts();
        setIsConflictDialogOpen(false);
      } catch (error) {
        logger.error(
          {
            sectionId: activeSection?.id,
            reason: error instanceof Error ? error.message : String(error),
          },
          'Conflict resolution failed'
        );
      } finally {
        setIsResolvingConflict(false);
      }
    }, [activeSection?.id, resolveConflicts]);

    const handleSubmitReview = useCallback(async () => {
      if (!activeSection) {
        return;
      }

      if (!sectionDraftState.draftId) {
        setReviewError('Save a draft before submitting for review.');
        return;
      }

      setReviewError(null);
      setIsReviewSubmitting(true);

      try {
        const response = await client.submitDraft(activeSection.id, {
          draftId: sectionDraftState.draftId,
          summaryNote: draftState.summaryNote ?? '',
        });

        updateSection({
          id: activeSection.id,
          status: response.status === 'approved' ? 'ready' : 'review',
          lastSummary: response.summaryNote ?? draftState.summaryNote ?? null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to submit draft for review.';
        setReviewError(message);
      } finally {
        setIsReviewSubmitting(false);
      }
    }, [activeSection, client, sectionDraftState.draftId, draftState.summaryNote, updateSection]);

    const handleApprove = useCallback(
      async ({ approvalNote }: { approvalNote: string }): Promise<void> => {
        if (!activeSection || !sectionDraftState.draftId) {
          setApprovalError('Draft information is missing. Save the draft before approving.');
          return;
        }

        setApprovalError(null);
        setIsApprovalSubmitting(true);

        try {
          const response = await client.approveSection(activeSection.id, {
            draftId: sectionDraftState.draftId,
            approvalNote: approvalNote.trim().length > 0 ? approvalNote : undefined,
          });

          setApprovalMetadata(activeSection.id, {
            approvedVersion: response.approvedVersion,
            approvedAt: response.approvedAt,
            approvedBy: response.approvedBy,
            lastSummary:
              approvalNote.trim().length > 0 ? approvalNote : (draftState.summaryNote ?? null),
            contentMarkdown: response.approvedContent,
          });

          cancelEditing(activeSection.id);
          setDiffView(false);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Section approval failed.';
          setApprovalError(message);
        } finally {
          setIsApprovalSubmitting(false);
        }
      },
      [
        activeSection,
        client,
        cancelEditing,
        setApprovalMetadata,
        sectionDraftState.draftId,
        draftState.summaryNote,
        setDiffView,
      ]
    );

    const handleReviewRequestChanges = useCallback(
      ({ approvalNote }: { approvalNote: string }) => {
        if (!activeSection) return;
        updateSection({
          id: activeSection.id,
          status: 'drafting',
          lastSummary:
            approvalNote.trim().length > 0 ? approvalNote : (draftState.summaryNote ?? null),
        });
        setApprovalError('Changes requested. The section remains in drafting state.');
      },
      [activeSection, updateSection, draftState.summaryNote]
    );

    const isReviewDisabled =
      draftState.conflictState !== 'clean' || !sectionDraftState.draftId || draftState.isSaving;
    const reviewDisabledReason = (() => {
      if (draftState.conflictState !== 'clean') {
        return 'Resolve conflicts before submitting for review.';
      }
      if (!sectionDraftState.draftId) {
        return 'Save a draft to generate a submission payload.';
      }
      return null;
    })();

    const renderingWarnings = draftState.formattingWarnings;
    const conflictServerSnapshot = (() => {
      if (typeof sectionDraftState.latestApprovedVersion !== 'number') {
        return null;
      }
      const snapshot =
        sectionDraftState.serverSnapshots?.[sectionDraftState.latestApprovedVersion] ?? null;
      if (!snapshot) {
        return null;
      }
      return {
        version: sectionDraftState.latestApprovedVersion,
        content: snapshot.content,
        capturedAt: snapshot.capturedAt ?? null,
      } satisfies {
        version: number;
        content: string;
        capturedAt?: string | null;
      };
    })();

    return (
      <>
        {!isE2EMode && hasPendingRehydrations && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-recovery-title"
            data-testid="draft-recovery-gate"
          >
            <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h2
                id="draft-recovery-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Review recovered drafts
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Recovered drafts were loaded from your device. Choose how to proceed before we fetch
                new server updates.
              </p>
              <ul className="mt-4 max-h-60 space-y-2 overflow-y-auto">
                {pendingRehydratedDrafts.map(draft => (
                  <li
                    key={draft.draftKey}
                    className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <p className="font-medium">{draft.sectionTitle}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {draft.baselineVersion ? `Baseline ${draft.baselineVersion}` : 'Local draft'}
                      {draft.lastEditedAt
                        ? ` · Last edited ${new Date(draft.lastEditedAt).toLocaleString()}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  variant="default"
                  onClick={() => void applyRecoveredDrafts()}
                  disabled={isRecoveryProcessing}
                >
                  {isRecoveryProcessing ? 'Applying…' : 'Apply recovered drafts'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void discardRecoveredDrafts()}
                  disabled={isRecoveryProcessing}
                >
                  {isRecoveryProcessing ? 'Discarding…' : 'Discard recovered drafts'}
                </Button>
              </div>
            </div>
          </div>
        )}
        {showQuotaBanner && (
          <div
            data-testid="draft-pruned-banner"
            role="alert"
            className="mb-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <span>
              {quotaMessage ??
                'Browser storage limit reached. Oldest drafts were pruned so you can continue editing.'}
            </span>
            <button
              type="button"
              className="text-xs font-semibold uppercase tracking-wide text-amber-800 underline hover:text-amber-900 dark:text-amber-200"
              onClick={() => {
                setShowQuotaBanner(false);
                setQuotaMessage(null);
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <div
          className={cn(
            'flex h-full w-full overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950',
            className
          )}
        >
          <div
            className={cn(
              'flex w-80 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-800',
              sidebarCollapsed && 'w-12'
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Sections</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh diff view"
                  onClick={() => handleOpenDiff()}
                  disabled={!isEditing || draftState.isDiffRefreshing}
                  className={cn(
                    showDiffView &&
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100'
                  )}
                >
                  <RefreshCw
                    className={cn('h-4 w-4', draftState.isDiffRefreshing && 'animate-spin')}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={
                    sidebarCollapsed ? 'Expand sections panel' : 'Collapse sections panel'
                  }
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1"
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {!sidebarCollapsed && toc && (
              <div className="flex-1 overflow-y-auto p-4">
                <TableOfContentsComponent
                  toc={{
                    ...toc,
                    sections: toc.sections.map(section => ({
                      ...section,
                      isExpanded: true,
                      isActive: section.sectionId === activeSectionId,
                    })),
                  }}
                  activeSectionId={activeSectionId}
                  onSectionClick={handleSectionClick}
                  onExpandToggle={() => undefined}
                />
              </div>
            )}

            {!sidebarCollapsed && pendingChangesCount > 0 && (
              <div className="border-t border-gray-200 p-4 text-sm text-orange-600 dark:border-gray-800 dark:text-orange-400">
                {pendingChangesCount} unsaved change{pendingChangesCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Document Editor
                  </h1>
                  {activeSection && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {activeSection.title}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {showDiffView && (
                    <Button variant="outline" size="sm" onClick={handleCloseDiff}>
                      Close diff view
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isDocumentQaOpen ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setIsDocumentQaOpen(prev => !prev)}
                      disabled={!activeSection}
                    >
                      {isDocumentQaOpen ? 'Close QA Review' : 'Open QA Review'}
                    </Button>
                    <Button
                      variant={isCoAuthorOpen ? 'default' : 'secondary'}
                      size="sm"
                      onClick={handleToggleCoAuthor}
                      disabled={!activeSection}
                    >
                      {isCoAuthorOpen ? 'Close Co-Author' : 'Open Co-Author'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden" onScroll={handleScroll}>
              <div
                className={cn(
                  'p-6',
                  isCoAuthorOpen || isDocumentQaOpen
                    ? 'lg:flex lg:items-start lg:gap-6'
                    : 'space-y-6'
                )}
              >
                <div
                  className={cn(
                    'min-w-0 space-y-6',
                    isCoAuthorOpen || isDocumentQaOpen ? 'lg:flex-1' : undefined
                  )}
                >
                  <DocumentQualityDashboard documentId={documentId} />

                  <div
                    className="flex flex-wrap items-center gap-3"
                    data-testid="document-action-bar"
                  >
                    <Button
                      variant="default"
                      disabled={isDocumentPublishBlocked || isDocumentRunning}
                      onClick={() =>
                        logQualityGateAction('[quality-gates] publish-document action requested')
                      }
                    >
                      Publish document
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isDocumentPublishBlocked || isDocumentRunning}
                      onClick={() =>
                        logQualityGateAction('[quality-gates] export-document action requested')
                      }
                    >
                      Export document
                    </Button>
                  </div>

                  {(documentPublishCopy || documentSlaWarningCopy) && (
                    <div className="space-y-1 text-sm">
                      {documentPublishCopy && (
                        <p
                          className={cn(
                            isDocumentPublishBlocked
                              ? 'text-rose-900 dark:text-rose-200'
                              : 'text-muted-foreground'
                          )}
                        >
                          {documentPublishCopy}{' '}
                          {isDocumentPublishBlocked
                            ? 'Resolve blockers via the dashboard above to enable publishing.'
                            : ''}
                        </p>
                      )}
                      {documentSlaWarningCopy && (
                        <p className="text-muted-foreground">{documentSlaWarningCopy}</p>
                      )}
                    </div>
                  )}

                  {activeSection ? (
                    <div data-section-id={activeSection.id}>
                      <DocumentSectionPreview
                        section={activeSection}
                        assumptionSession={activeAssumptionSession}
                        documentId={documentId}
                        projectSlug={projectSlug}
                        onEnterEdit={handleEnterEdit}
                        isEditDisabled={
                          (isEditing && activeSection.id !== activeSectionId) ||
                          assumptionFlowBlocking
                        }
                        approval={{
                          approvedAt: activeSection.approvedAt ?? undefined,
                          approvedBy: activeSection.approvedBy ?? undefined,
                          approvedVersion: activeSection.approvedVersion ?? undefined,
                          reviewerSummary: activeSection.lastSummary ?? undefined,
                        }}
                      />

                      {shouldEnableAssumptionsFlow && (
                        <div className="mt-6 space-y-3" data-testid="assumptions-checklist-panel">
                          {assumptionFlowError && (
                            <div
                              className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
                              role="alert"
                            >
                              {assumptionFlowError}
                            </div>
                          )}

                          <AssumptionsChecklist
                            prompts={assumptionFlowState?.prompts ?? []}
                            overridesOpen={assumptionFlowState?.overridesOpen ?? 0}
                            isLoading={isAssumptionFlowLoading}
                            onRespond={respondToAssumptionPrompt}
                            streamingStatus={assumptionStreaming.status}
                            streamingBullets={assumptionStreaming.bullets}
                            streamingHasOutOfOrder={assumptionStreaming.hasOutOfOrder}
                            streamingAnnouncements={assumptionStreaming.announcements}
                            fallbackState={assumptionStreaming.fallback}
                          />
                        </div>
                      )}

                      {isEditing && (
                        <div className="mt-6 space-y-6" data-testid="section-editor-panel">
                          <FormattingToolbar
                            onToggleHeading={() =>
                              updateDraft(`${draftState.content}\n\n# Heading`)
                            }
                            onToggleBold={() => updateDraft(`${draftState.content} **bold**`)}
                            onToggleItalic={() => updateDraft(`${draftState.content} _italic_`)}
                            onToggleOrderedList={() =>
                              updateDraft(`${draftState.content}\n1. Ordered item`)
                            }
                            onToggleBulletList={() =>
                              updateDraft(`${draftState.content}\n- Bullet item`)
                            }
                            onInsertTable={() =>
                              updateDraft(`${draftState.content}\n| Col A | Col B |\n| --- | --- |`)
                            }
                            onInsertLink={() =>
                              updateDraft(`${draftState.content} [Link](https://example.com)`)
                            }
                            onToggleCode={() => {
                              const snippet = `${draftState.content}

\`\`\`ts
console.log('code snippet');
\`\`\``;
                              updateDraft(snippet);
                            }}
                            onToggleQuote={() => updateDraft(`${draftState.content}\n> Quote`)}
                          />

                          <MilkdownEditor
                            value={draftState.content}
                            onChange={handleContentChange}
                            onFormattingAnnotationsChange={handleFormattingAnnotationsChange}
                            onRequestDiff={handleOpenDiff}
                            dataTestId="draft-markdown-editor"
                          />

                          <ManualSavePanel
                            summaryNote={draftState.summaryNote}
                            onSummaryChange={handleSummaryChange}
                            onManualSave={handleManualSave}
                            isSaving={draftState.isSaving}
                            formattingWarnings={renderingWarnings}
                            conflictState={draftState.conflictState}
                            conflictReason={sectionDraftState.conflictReason}
                            lastSavedAt={sectionDraftState.lastSavedAt}
                            lastSavedBy={sectionDraftState.lastSavedBy}
                            lastManualSaveAt={sectionDraftState.lastManualSaveAt}
                            saveErrorMessage={manualSaveError}
                            onOpenDiff={handleOpenDiff}
                            onSubmitReview={handleSubmitReview}
                            isDiffLoading={draftState.isDiffRefreshing}
                            disableManualSave={draftState.isSaving}
                            isReviewDisabled={isReviewDisabled || isReviewSubmitting}
                            reviewDisabledReason={reviewDisabledReason}
                          />

                          {reviewError && (
                            <div
                              className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
                              role="alert"
                            >
                              {reviewError}
                            </div>
                          )}

                          {showDiffView && (
                            <DiffViewer
                              diff={draftState.diff}
                              isLoading={draftState.isDiffRefreshing}
                              errorMessage={null}
                              headerSlot={
                                <Button variant="outline" size="sm" onClick={handleCloseDiff}>
                                  Close
                                </Button>
                              }
                            />
                          )}

                          {(activeSection.status === 'review' ||
                            activeSection.status === 'ready') && (
                            <div className="space-y-3">
                              {approvalError && (
                                <div
                                  className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
                                  role="alert"
                                >
                                  {approvalError}
                                </div>
                              )}
                              <ApprovalControls
                                sectionTitle={activeSection.title}
                                currentStatus={activeSection.status}
                                reviewerSummary={approvalSummary}
                                draftVersion={sectionDraftState.draftVersion ?? undefined}
                                approvedVersion={activeSection.approvedVersion ?? undefined}
                                approvedAt={activeSection.approvedAt}
                                approvedBy={activeSection.approvedBy}
                                approvalNote={approvalSummary ?? undefined}
                                onApprove={({ approvalNote }) => handleApprove({ approvalNote })}
                                onRequestChanges={({ approvalNote }) =>
                                  handleReviewRequestChanges({ approvalNote })
                                }
                                isSubmitting={isApprovalSubmitting}
                                isDisabled={draftState.conflictState !== 'clean'}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                      <p>Select a section from the table of contents to view details.</p>
                    </div>
                  )}
                </div>
                {(isCoAuthorOpen || isDocumentQaOpen) && activeSection ? (
                  <div className="mt-6 w-full max-w-full space-y-6 lg:mt-0 lg:w-[360px] lg:flex-shrink-0">
                    {isCoAuthorOpen ? (
                      <CoAuthorSidebar
                        documentTitle={documentTitle}
                        sectionTitle={activeSection.title}
                        activeIntent={activeCoAuthorIntent}
                        onIntentChange={handleIntentChange}
                        selectedKnowledge={selectedKnowledgeIds}
                        knowledgeOptions={knowledgeOptions}
                        onToggleKnowledge={toggleKnowledge}
                        selectedDecisions={selectedDecisionIds}
                        decisionOptions={decisionOptions}
                        onToggleDecision={toggleDecision}
                        onRunAnalyze={handleAnalyzeRequest}
                        onRunProposal={handleProposalRequest}
                        onApproveProposal={handleApproveProposal}
                        onRejectProposal={handleRejectProposal}
                        onRequestChanges={handleCoAuthorRequestChanges}
                        progress={coAuthorProgress}
                        replacementNotice={coAuthorReplacementNotice}
                        onCancelStreaming={cancelCoAuthorStreaming}
                        onRetry={handleRetryAssistant}
                        pendingProposal={coAuthorPendingProposal}
                        fallback={coAuthorFallback}
                        transcript={coAuthorTranscript}
                      />
                    ) : null}
                    {isDocumentQaOpen ? (
                      <DocumentQaPanel
                        documentTitle={documentTitle}
                        sectionTitle={activeSection.title}
                        progress={documentQaProgress}
                        transcript={documentQaTranscript}
                        replacementNotice={documentQaReplacementNotice}
                        onCancel={() => cancelDocumentQaStreaming()}
                        onRetry={() => {
                          void ensureDocumentQaSession();
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <ConflictDialog
            open={isConflictDialogOpen}
            conflictState={draftState.conflictState}
            conflictReason={sectionDraftState.conflictReason}
            latestApprovedVersion={sectionDraftState.latestApprovedVersion ?? undefined}
            rebasedDraft={sectionDraftState.rebasedDraft ?? undefined}
            events={sectionDraftState.conflictEvents}
            serverSnapshot={conflictServerSnapshot ?? undefined}
            isProcessing={isResolvingConflict}
            onConfirm={handleResolveConflicts}
            onCancel={() => setIsConflictDialogOpen(false)}
          />
        </div>
      </>
    );
  }
);

DocumentEditor.displayName = 'DocumentEditor';

export default DocumentEditor;
