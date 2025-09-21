import { memo, useCallback, useEffect, useState } from 'react';
import { RefreshCw, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { logger } from '../utils/logger';

import { useEditorStore } from '../stores/editor-store';
import { useDocumentStore } from '../stores/document-store';
import { useSessionStore } from '../stores/session-store';
import type { PendingChange } from '../types/pending-change';

import TableOfContentsComponent from './table-of-contents';
import SectionCard from './section-card';
import MilkdownEditor from './milkdown-editor';
import DiffPreview from './diff-preview';

interface DocumentEditorProps {
  documentId: string;
  className?: string;
}

export const DocumentEditor = memo<DocumentEditorProps>(({ documentId, className }) => {
  // Store state
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
    markAsSaving,
    markAsSaved,
    toggleDiffView,
  } = useEditorStore();

  const { toc, setTableOfContents } = useDocumentStore();

  const { updateScrollPosition } = useSessionStore();

  // TODO: Get expandedSections from session store when available
  const expandedSections: string[] = [];

  // Local state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeSection = activeSectionId ? sections[activeSectionId] : null;
  // TODO: Get pending changes from pending changes store when implemented
  const activePendingChanges: PendingChange[] = [];

  // Load document on mount
  useEffect(() => {
    const initializeDocument = async () => {
      setIsLoading(true);
      try {
        // TODO: Implement document loading when API is ready
        // await loadDocument(documentId);

        // Mock data for now
        setTableOfContents({
          documentId,
          sections: [],
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load document';
        setError(errorMessage);
        logger.error(
          { operation: 'document_load', documentId, error: errorMessage },
          'Failed to load document'
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeDocument();
  }, [documentId, setTableOfContents]);

  // Update current content when active section changes
  useEffect(() => {
    if (activeSection) {
      setCurrentContent(activeSection.contentMarkdown);
    }
  }, [activeSection]);

  // Handle ToC navigation
  const handleSectionClick = useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);

      // Scroll to section in main content area
      const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [setActiveSection]
  );

  // Handle ToC expand/collapse
  const handleExpandToggle = useCallback((_sectionId: string, _expanded: boolean) => {
    // TODO: Implement section expansion when available
    // toggleSectionExpansion(sectionId, expanded);
  }, []);

  // Handle section editing
  const handleEditClick = useCallback(
    (sectionId: string) => {
      enterEditMode(sectionId);
      if (sectionId !== activeSectionId) {
        setActiveSection(sectionId);
      }
    },
    [enterEditMode, setActiveSection, activeSectionId]
  );

  // Handle content changes in editor
  const handleContentChange = useCallback(
    (markdown: string) => {
      setCurrentContent(markdown);

      if (activeSectionId && activeSection) {
        // Create pending change if content differs from saved content
        if (markdown !== activeSection.contentMarkdown) {
          // TODO: Create pending change with diff-match-patch
          // For now, just update the section content
          updateSection({
            id: activeSectionId,
            contentMarkdown: markdown,
            hasContent: markdown.trim().length > 0,
          });
        }
      }
    },
    [activeSectionId, activeSection, updateSection]
  );

  // Handle save
  const handleSaveClick = useCallback(
    async (sectionId: string) => {
      if (!sections[sectionId]) return;

      try {
        markAsSaving(sectionId);

        // TODO: Save pending changes when API is ready
        // await savePendingChanges(sectionId);

        // Mock save delay
        await new Promise(resolve => setTimeout(resolve, 500));

        markAsSaved(sectionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save section';
        setError(errorMessage);
        logger.error(
          { operation: 'section_save', sectionId, error: errorMessage },
          'Failed to save section'
        );
        // Reset to edit mode on error
        enterEditMode(sectionId);
      }
    },
    [sections, markAsSaving, markAsSaved, enterEditMode]
  );

  // Handle cancel
  const handleCancelClick = useCallback(
    (sectionId: string) => {
      const section = sections[sectionId];
      if (section) {
        // Reset content to saved version
        setCurrentContent(section.contentMarkdown);
        cancelEditing(sectionId);
      }
    },
    [sections, cancelEditing]
  );

  // Handle scroll sync
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = event.currentTarget.scrollTop;
      updateScrollPosition(scrollTop);
    },
    [updateScrollPosition]
  );

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading document...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <div className="mb-4 text-red-500">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Error Loading Document
        </h3>
        <p className="mb-4 text-gray-600 dark:text-gray-400">{error}</p>
        <Button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            // Trigger reload
            window.location.reload();
          }}
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full bg-white dark:bg-gray-900', className)}>
      {/* Sidebar - Table of Contents */}
      <div
        className={cn(
          'flex-shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-300 dark:border-gray-700 dark:bg-gray-800',
          sidebarCollapsed ? 'w-12' : 'w-80'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          {!sidebarCollapsed && (
            <>
              <h2 className="text-lg font-semibold">Contents</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleDiffView}
                  className={cn(showDiffView && 'bg-blue-100 dark:bg-blue-900')}
                  title="Toggle diff view"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
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

        {/* ToC Content */}
        {!sidebarCollapsed && toc && (
          <div className="flex-1 overflow-y-auto p-4">
            <TableOfContentsComponent
              toc={{
                ...toc,
                sections: toc.sections.map(section => ({
                  ...section,
                  isExpanded: expandedSections.includes(section.sectionId),
                  isActive: section.sectionId === activeSectionId,
                })),
              }}
              activeSectionId={activeSectionId}
              onSectionClick={handleSectionClick}
              onExpandToggle={handleExpandToggle}
            />
          </div>
        )}

        {/* Pending changes indicator */}
        {!sidebarCollapsed && pendingChangesCount > 0 && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <div className="text-sm text-orange-600 dark:text-orange-400">
              {pendingChangesCount} unsaved change{pendingChangesCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Content Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Document Editor</h1>
              {activeSection && (
                <p className="mt-1 text-gray-600 dark:text-gray-400">{activeSection.title}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditing && showDiffView && activePendingChanges.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => toggleDiffView()}>
                  {showDiffView ? 'Hide' : 'Show'} Changes
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-hidden">
          {showDiffView && isEditing && activePendingChanges.length > 0 ? (
            /* Diff View */
            <div className="h-full overflow-y-auto p-4" onScroll={handleScroll}>
              <DiffPreview changes={activePendingChanges} title="Pending Changes" />
            </div>
          ) : (
            /* Section Cards View */
            <div className="h-full overflow-y-auto" onScroll={handleScroll}>
              <div className="space-y-6 p-4">
                {Object.values(sections)
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map(section => (
                    <div key={section.id} data-section-id={section.id}>
                      <SectionCard
                        section={section}
                        isActive={section.id === activeSectionId}
                        onEditClick={handleEditClick}
                        onSaveClick={handleSaveClick}
                        onCancelClick={handleCancelClick}
                      />

                      {/* Inline Editor */}
                      {section.id === activeSectionId && isEditing && (
                        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                          <MilkdownEditor
                            value={currentContent}
                            placeholder={section.placeholderText}
                            onChange={handleContentChange}
                            className="border-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                {Object.keys(sections).length === 0 && (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <p>No sections found in this document.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DocumentEditor.displayName = 'DocumentEditor';

export default DocumentEditor;
