import { memo, useCallback, type ComponentType, type SVGProps } from 'react';
import { Edit, Eye, Save, Loader2, FileText, Clock, User, ShieldAlert } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import type { AssumptionFlowState } from '../assumptions-flow';
import type { SectionView, SectionViewState } from '../types/section-view';
import { SectionQualityStatusChip, SectionRemediationList } from '../quality-gates/components';
import { useQualityGates } from '../quality-gates/hooks';

interface SectionCardProps {
  section: SectionView;
  assumptionSession?: AssumptionFlowState | null;
  isActive?: boolean;
  onEditClick?: (sectionId: string) => void;
  onSaveClick?: (sectionId: string) => void;
  onCancelClick?: (sectionId: string) => void;
  className?: string;
}

const stateLabels: Record<SectionViewState, string> = {
  idle: 'Idle',
  read_mode: 'Reading',
  edit_mode: 'Editing',
  saving: 'Saving...',
};

const stateIcons: Record<SectionViewState, ComponentType<SVGProps<SVGSVGElement>>> = {
  idle: FileText,
  read_mode: Eye,
  edit_mode: Edit,
  saving: Loader2,
};

const stateColors: Record<SectionViewState, string> = {
  idle: 'text-gray-500',
  read_mode: 'text-blue-500',
  edit_mode: 'text-green-500',
  saving: 'text-orange-500',
};

export const SectionCard = memo<SectionCardProps>(
  ({
    section,
    assumptionSession,
    isActive,
    onEditClick,
    onSaveClick,
    onCancelClick,
    className,
  }) => {
    const StateIcon = stateIcons[section.viewState];
    const isEditing = section.viewState === 'edit_mode';
    const isSaving = section.viewState === 'saving';
    const isReadMode = section.viewState === 'read_mode';
    const canEdit = isReadMode || section.viewState === 'idle';

    const handleEditClick = useCallback(() => {
      onEditClick?.(section.id);
    }, [section.id, onEditClick]);

    const handleSaveClick = useCallback(() => {
      onSaveClick?.(section.id);
    }, [section.id, onSaveClick]);

    const handleCancelClick = useCallback(() => {
      onCancelClick?.(section.id);
    }, [section.id, onCancelClick]);

    const formatLastModified = useCallback((timestamp: string) => {
      if (!timestamp) {
        return 'Unknown';
      }

      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return 'Unknown';
      }

      return date.toLocaleString();
    }, []);

    const qualityGates = useQualityGates({
      sectionId: section.id,
      documentId: section.docId,
    });

    const isSaveBlocked = qualityGates.isSubmissionBlocked;

    return (
      <Card
        className={cn(
          'border border-gray-200 bg-white text-gray-900 transition-all duration-200 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100',
          isActive && 'shadow-lg ring-2 ring-blue-500',
          className
        )}
        data-testid={section.hasContent ? 'section-card' : 'section-empty'}
        data-section-id={section.id}
        data-active={isActive || false}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold" title={section.title}>
                {section.title}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <StateIcon
                  role="graphics-symbol"
                  aria-hidden="true"
                  className={cn(
                    'h-3 w-3',
                    stateColors[section.viewState],
                    isSaving && 'animate-spin'
                  )}
                />
                <span>{stateLabels[section.viewState]}</span>
                {section.editingUser && (
                  <>
                    <User className="h-3 w-3" />
                    <span>by {section.editingUser}</span>
                  </>
                )}
                {assumptionSession && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                    <ShieldAlert className="h-3 w-3" />
                    {assumptionSession.promptsRemaining} pending
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  disabled={isSaving}
                  data-testid="edit-button"
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Edit
                </Button>
              )}

              {isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelClick}
                    disabled={isSaving}
                    data-testid="cancel-button"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={isSaving || isSaveBlocked}
                    data-testid="save-section"
                  >
                    {isSaving ? (
                      <Loader2
                        role="graphics-symbol"
                        aria-hidden="true"
                        className="mr-1 h-3 w-3 animate-spin"
                      />
                    ) : (
                      <Save role="graphics-symbol" aria-hidden="true" className="mr-1 h-3 w-3" />
                    )}
                    Save
                  </Button>
                </>
              )}
            </div>

            <div className="mt-3 w-full max-w-xs">
              <SectionQualityStatusChip
                status={qualityGates.status}
                statusMessage={qualityGates.statusMessage}
                timeoutCopy={qualityGates.timeoutCopy}
                lastStatus={qualityGates.lastStatus ?? null}
                incidentId={qualityGates.incidentId}
                isSubmissionBlocked={qualityGates.isSubmissionBlocked}
                blockerCount={qualityGates.blockerCount}
                onRun={qualityGates.runSection}
                onRetry={qualityGates.runSection}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {qualityGates.remediation.length > 0 && (
            <div className="mb-4">
              <SectionRemediationList items={qualityGates.remediation} />
            </div>
          )}

          {section.hasContent ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              data-testid="section-content"
            >
              {/* Content will be rendered by parent component */}
              <div className="italic text-gray-500">Content rendered by editor component</div>
            </div>
          ) : (
            <div
              className="py-8 text-center text-gray-500 dark:text-gray-400"
              data-testid="placeholder-text"
            >
              <FileText className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="mx-auto mb-4 max-w-md text-sm">{section.placeholderText}</p>
              <Button
                variant="outline"
                onClick={handleEditClick}
                disabled={isSaving}
                data-testid="start-drafting"
              >
                Begin Drafting
              </Button>
            </div>
          )}

          {assumptionSession && (
            <div
              className="mt-4 space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-100"
              data-testid="assumption-fixture-snippet"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase">Assumptions</span>
                <span className="rounded bg-amber-200 px-1 py-0.5 text-[10px] font-semibold text-amber-900">
                  {assumptionSession.overridesOpen} overrides
                </span>
              </div>
              <ul className="space-y-1">
                {assumptionSession.prompts.slice(0, 2).map(prompt => (
                  <li key={prompt.id} className="leading-snug">
                    <span className="font-semibold">{prompt.heading}:</span>{' '}
                    {prompt.status.replace('_', ' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section metadata */}
          <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>Status: {section.status}</span>
                <span>Depth: {section.depth}</span>
                {section.qualityGateStatus && <span>Quality: {section.qualityGateStatus}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span title={section.lastModified}>{formatLastModified(section.lastModified)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

SectionCard.displayName = 'SectionCard';

export default SectionCard;
