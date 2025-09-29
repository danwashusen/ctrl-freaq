import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';

import { useEditorStore } from '../stores/editor-store';
import { useDocumentStore } from '../stores/document-store';
import { useSessionStore } from '../stores/session-store';
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

export interface DocumentEditorProps {
  documentId: string;
  initialSectionId?: string;
  fixtureDocument?: DocumentFixture;
  className?: string;
}

const sortSections = (sections: Record<string, SectionView>): SectionView[] =>
  Object.values(sections).sort((a, b) => a.orderIndex - b.orderIndex);

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
    const editEntryTimerRef = useRef<(() => void) | null>(null);
    const editRenderTimerRef = useRef<(() => void) | null>(null);

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
    } = useEditorStore(state => ({
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
    }));

    const { toc, setTableOfContents, getAssumptionSession } = useDocumentStore(state => ({
      toc: state.toc,
      setTableOfContents: state.setTableOfContents,
      getAssumptionSession: state.getAssumptionSession,
    }));

    const { updateScrollPosition, setActiveSection: setSessionActiveSection } = useSessionStore(
      state => ({
        updateScrollPosition: state.updateScrollPosition,
        setActiveSection: state.setActiveSection,
      })
    );
    const session = useSessionStore(state => state.session);

    const client = useMemo(() => {
      const baseUrl =
        fixtureDocument && typeof window !== 'undefined'
          ? `${window.location.origin.replace(/\/$/, '')}/__fixtures/api`
          : undefined;
      return createSectionEditorClient(baseUrl ? { baseUrl } : undefined);
    }, [fixtureDocument]);

    const sectionsList = useMemo(() => sortSections(sections), [sections]);
    const activeSection = activeSectionId ? (sections[activeSectionId] ?? null) : null;

    const shouldEnableAssumptionsFlow =
      activeSection?.status === 'assumptions' ||
      (!!activeSection && !activeSection.hasContent && !activeSection.assumptionsResolved);

    const {
      state: assumptionFlowState,
      isLoading: isAssumptionFlowLoading,
      error: assumptionFlowError,
      respond: respondToAssumptionPrompt,
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

    const sectionDraftState = useSectionDraftStore(state => ({
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
      setFormattingAnnotations: state.setFormattingAnnotations,
    }));
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
      userId: session?.userId ?? 'local-user',
      initialSummaryNote: activeSection?.summaryNote ?? activeSection?.lastSummary ?? '',
      initialConflictState: activeSection?.conflictState,
      initialDraftId: activeSection?.draftId,
      initialDraftVersion: activeSection?.draftVersion,
      loadPersistedDraft: Boolean(activeSection),
    });

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

    const handleRequestChanges = useCallback(
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
    const approvalSummary = resolveSummaryForApproval(
      activeSection ?? ({} as SectionView),
      draftState.summaryNote
    );

    return (
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
                  showDiffView && 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-100'
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
                aria-label={sidebarCollapsed ? 'Expand sections panel' : 'Collapse sections panel'}
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
              {showDiffView && (
                <Button variant="outline" size="sm" onClick={handleCloseDiff}>
                  Close diff view
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden" onScroll={handleScroll}>
            <div className="space-y-6 p-6">
              {activeSection ? (
                <div data-section-id={activeSection.id}>
                  <DocumentSectionPreview
                    section={activeSection}
                    assumptionSession={activeAssumptionSession}
                    documentId={documentId}
                    onEnterEdit={handleEnterEdit}
                    isEditDisabled={
                      (isEditing && activeSection.id !== activeSectionId) || assumptionFlowBlocking
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
                      />
                    </div>
                  )}

                  {isEditing && (
                    <div className="mt-6 space-y-6" data-testid="section-editor-panel">
                      <FormattingToolbar
                        onToggleHeading={() => updateDraft(`${draftState.content}\n\n# Heading`)}
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

                      {(activeSection.status === 'review' || activeSection.status === 'ready') && (
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
                              handleRequestChanges({ approvalNote })
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
          </div>
        </div>

        <ConflictDialog
          open={isConflictDialogOpen}
          conflictState={draftState.conflictState}
          conflictReason={sectionDraftState.conflictReason}
          latestApprovedVersion={sectionDraftState.latestApprovedVersion ?? undefined}
          rebasedDraft={sectionDraftState.rebasedDraft ?? undefined}
          events={sectionDraftState.conflictEvents}
          isProcessing={isResolvingConflict}
          onConfirm={handleResolveConflicts}
          onCancel={() => setIsConflictDialogOpen(false)}
        />
      </div>
    );
  }
);

DocumentEditor.displayName = 'DocumentEditor';

export default DocumentEditor;
