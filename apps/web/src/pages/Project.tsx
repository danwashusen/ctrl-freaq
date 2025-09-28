import { UserButton } from '@/lib/clerk-client';
import { ArrowLeft, Edit, FileText, Settings, Share } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TemplateUpgradeBanner } from '../components/editor/TemplateUpgradeBanner';
import { TemplateValidationGate } from '../components/editor/TemplateValidationGate';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useApi } from '../lib/api-context';
import { logger } from '../lib/logger';
import { useTemplateStore } from '../stores/template-store';

type TemplateSectionOutline = {
  id: string;
  title?: string;
  orderIndex?: number;
  type?: string;
  children?: TemplateSectionOutline[];
};

interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentsCount?: number;
}

function getNestedValue(source: unknown, path: Array<string | number>): unknown {
  if (!path.length) {
    return source;
  }
  const [key, ...rest] = path;
  if (Array.isArray(source) && typeof key === 'number') {
    return getNestedValue(source[key], rest);
  }
  if (source && typeof source === 'object' && typeof key === 'string') {
    const value = (source as Record<string, unknown>)[key];
    return getNestedValue(value, rest);
  }
  return undefined;
}

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, client } = useApi();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const templateStatus = useTemplateStore(state => state.status);
  const templateDocument = useTemplateStore(state => state.document);
  const templateMigration = useTemplateStore(state => state.migration);
  const removedVersion = useTemplateStore(state => state.removedVersion);
  const templateError = useTemplateStore(state => state.error);
  const templateErrorCode = useTemplateStore(state => state.errorCode);
  const upgradeFailure = useTemplateStore(state => state.upgradeFailure);
  const sections = useTemplateStore(state => state.sections);
  const validator = useTemplateStore(state => state.validator);
  const formValue = useTemplateStore(state => state.formValue);
  const setFormValue = useTemplateStore(state => state.setFormValue);
  const loadDocument = useTemplateStore(state => state.loadDocument);
  const resetTemplate = useTemplateStore(state => state.reset);

  useEffect(() => {
    let cancelled = false;

    async function fetchProject(projectId: string) {
      try {
        setLoading(true);
        setError(null);
        const result = await projects.getById(projectId);
        if (!cancelled) {
          setProject({
            id: result.id,
            name: result.name,
            description: result.description || 'No description provided',
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            documentsCount: 0,
          });
        }
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Error fetching project.';
        if (!cancelled) {
          setError(message);
          setProject(null);
        }
        logger.error(
          'project.fetch_failed',
          { projectId },
          fetchError instanceof Error ? fetchError : undefined
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (id && id !== 'new') {
      void fetchProject(id);
      void loadDocument({ apiClient: client, documentId: id });
    } else if (id === 'new') {
      setProject({
        id: 'new',
        name: 'New Project',
        description: 'Create a new documentation project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentsCount: 0,
      });
      resetTemplate();
      setLoading(false);
    }

    return () => {
      cancelled = true;
      resetTemplate();
    };
  }, [client, id, loadDocument, projects, resetTemplate]);

  const migrationSummary = useMemo(() => {
    if (!templateMigration || !templateDocument) {
      return null;
    }
    return {
      status: templateMigration.status,
      fromVersion: templateMigration.fromVersion,
      toVersion: templateMigration.toVersion,
      templateId: templateDocument.templateId,
      completedAt: templateMigration.completedAt ?? undefined,
    };
  }, [templateDocument, templateMigration]);

  const removedVersionInfo = useMemo(() => {
    if (!removedVersion) {
      return null;
    }
    return {
      templateId: removedVersion.templateId,
      version: removedVersion.version,
      message:
        'This document references a removed template version. Ask a template manager to reinstate or migrate the template before editing.',
    };
  }, [removedVersion]);

  const handleFieldChange = useCallback(
    (
      setFieldValue: (path: Array<string | number>, value: unknown) => void,
      path: Array<string>,
      value: unknown
    ) => {
      setFieldValue(path, value);
    },
    []
  );

  const renderSections = useCallback(
    (
      sectionList: TemplateSectionOutline[],
      setFieldValue: (path: Array<string | number>, value: unknown) => void,
      parentPath: string[] = []
    ) => {
      const currentValues = formValue ?? {};
      return sectionList.map(section => {
        const path = [...parentPath, section.id];
        const fieldValue = getNestedValue(currentValues, path) ?? '';
        const key = path.join('.');

        if (section.children && section.children.length > 0) {
          return (
            <fieldset key={key} className="space-y-4 rounded-md border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-700">
                {section.title ?? section.id}
              </legend>
              {renderSections(section.children, setFieldValue, path)}
            </fieldset>
          );
        }

        const isLongText = section.type === 'markdown' || section.type === 'string';

        return (
          <div key={key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor={key}>
              {section.title ?? section.id}
            </label>
            {isLongText ? (
              <textarea
                id={key}
                className="w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={section.type === 'markdown' ? 6 : 3}
                value={String(fieldValue ?? '')}
                onChange={event => handleFieldChange(setFieldValue, path, event.target.value)}
              />
            ) : (
              <input
                id={key}
                className="w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={String(fieldValue ?? '')}
                onChange={event => handleFieldChange(setFieldValue, path, event.target.value)}
              />
            )}
          </div>
        );
      });
    },
    [formValue, handleFieldChange]
  );

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-lg rounded-md border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900">Failed to load project</h2>
          <p className="mt-2 text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="flex h-screen items-center justify-center">Project not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Share className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">{project.name}</h2>
          <p className="text-gray-600">{project.description}</p>
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(project.createdAt).toLocaleDateString()} • Last updated:{' '}
            {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{project.documentsCount ?? 0}</div>
              <p className="text-sm text-gray-600">Total documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Templates Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{templateDocument ? 1 : 0}</div>
              <p className="text-sm text-gray-600">Active templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Export Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">85%</div>
              <p className="text-sm text-gray-600">Completion status</p>
            </CardContent>
          </Card>
        </div>

        {id !== 'new' && (
          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Document Template</h3>
            <TemplateUpgradeBanner
              migration={migrationSummary}
              removedVersion={removedVersionInfo}
              upgradeFailure={upgradeFailure}
            >
              {templateStatus === 'loading' && (
                <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
                  Loading template details…
                </div>
              )}

              {templateStatus === 'blocked' && removedVersionInfo ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Editing is disabled until the template manager restores or migrates this version.
                </div>
              ) : null}

              {templateStatus === 'upgrade_failed' && upgradeFailure ? (
                <div
                  className="rounded-md border border-amber-200 bg-amber-100 p-4 text-sm text-amber-900"
                  data-testid="template-upgrade-failed-guidance"
                >
                  Editing is disabled until the auto-upgrade issues above are resolved and content
                  passes validation.
                </div>
              ) : null}

              {templateStatus === 'error' && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  {templateError ?? 'Failed to load template details. Try reloading the page.'}
                  {templateErrorCode ? (
                    <div className="mt-2 text-xs text-red-800">Error code: {templateErrorCode}</div>
                  ) : null}
                </div>
              )}

              {templateStatus === 'ready' && templateDocument && validator ? (
                <TemplateValidationGate
                  documentId={templateDocument.id}
                  templateId={templateDocument.templateId}
                  validator={validator}
                  value={formValue ?? {}}
                  onChange={value => {
                    const nextValue =
                      value && typeof value === 'object' && !Array.isArray(value)
                        ? (value as Record<string, unknown>)
                        : {};
                    setFormValue(nextValue);
                  }}
                  onValid={value => {
                    const nextValue =
                      value && typeof value === 'object' && !Array.isArray(value)
                        ? (value as Record<string, unknown>)
                        : {};
                    logger.info('document.template.validated', {
                      documentId: templateDocument.id,
                      templateId: templateDocument.templateId,
                      templateVersion: templateDocument.templateVersion,
                    });
                    setFormValue(nextValue);
                  }}
                >
                  {({ submit, setFieldValue, errors }) => (
                    <form
                      data-testid="document-editor-form"
                      className="space-y-6"
                      onSubmit={event => {
                        event.preventDefault();
                        submit();
                      }}
                    >
                      {sections.length === 0 ? (
                        <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
                          No template sections available for editing.
                        </p>
                      ) : (
                        renderSections(sections, setFieldValue)
                      )}

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Validation Issues</h4>
                        <ul
                          data-testid="template-errors"
                          className="space-y-1 text-sm text-red-700"
                        >
                          {errors.map(issue => (
                            <li key={issue.path.join('.') || issue.message}>{issue.message}</li>
                          ))}
                        </ul>
                        {errors.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            All template fields satisfy the schema.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <Button type="submit" className="inline-flex items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  )}
                </TemplateValidationGate>
              ) : null}
            </TemplateUpgradeBanner>
          </section>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Create Document
              </CardTitle>
              <CardDescription>Start writing a new document for this project</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Edit className="mr-2 h-5 w-5" />
                Edit Templates
              </CardTitle>
              <CardDescription>Customize templates for this project</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Share className="mr-2 h-5 w-5" />
                Export Project
              </CardTitle>
              <CardDescription>Export documents in various formats</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}
