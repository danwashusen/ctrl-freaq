import { UserButton } from '@clerk/clerk-react';
import { ArrowLeft, FileText, Edit, Share, Settings } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { logger } from '../lib/logger';

interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
}

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = useCallback(
    async (projectId: string) => {
      try {
        setLoading(true);
        // API call will be implemented in T048
        setProject({
          id: projectId,
          name: 'Sample Project',
          description: 'This is a sample project to demonstrate the interface',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          documentsCount: 5,
        });
      } catch (error) {
        logger.error(
          'Error fetching project',
          { projectId: id },
          error instanceof Error ? error : undefined
        );
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (id && id !== 'new') {
      void fetchProject(id);
    } else if (id === 'new') {
      // Handle new project creation
      setProject({
        id: 'new',
        name: 'New Project',
        description: 'Create a new documentation project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentsCount: 0,
      });
      setLoading(false);
    }
  }, [id, fetchProject]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
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
              <div className="text-3xl font-bold">{project.documentsCount}</div>
              <p className="text-sm text-gray-600">Total documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Templates Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">3</div>
              <p className="text-sm text-gray-600">Different templates</p>
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

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Project Actions</h3>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        {project.documentsCount > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-xl font-semibold text-gray-900">Recent Documents</h3>
            <div className="space-y-4">
              {Array.from({ length: Math.min(project.documentsCount, 3) }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Document {index + 1}</h4>
                        <p className="text-sm text-gray-600">
                          Last modified: {new Date().toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
