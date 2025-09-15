import { useUser, UserButton } from '@clerk/clerk-react';
import { Plus, FileText, Settings, Activity } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectData } from '@/lib/api';
import { useApi } from '@/lib/api-context';
import logger from '@/lib/logger';

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const api = useApi();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      logger.info('Fetching user projects');

      const projectsData = await api.projects.getAll();
      setProjects(projectsData);

      logger.info('Projects fetched successfully', { count: projectsData.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects';
      setError(errorMessage);
      logger.error(
        'Error fetching projects',
        { error: errorMessage },
        error instanceof Error ? error : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isLoaded) {
      void fetchProjects();
    }
  }, [isLoaded, fetchProjects]);

  const createProject = () => {
    logger.info('Navigating to project creation');
    navigate('/project/new');
  };

  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">CTRL FreaQ</h1>
              <div className="hidden text-sm text-gray-500 sm:block">
                AI-Optimized Documentation System
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
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
          <h2 className="mb-2 text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName || 'User'}
          </h2>
          <p className="text-gray-600">
            Manage your documentation projects and AI-optimized content.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{projects.length}</div>
              <p className="text-sm text-gray-600">Active projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-gray-600">Total documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-gray-600">Available templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-gray-600">
                <Activity className="mr-1 h-4 w-4" />
                No recent activity
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Your Projects</h3>
          <Button onClick={createProject}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="text-gray-500">Loading projects...</div>
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 py-12 text-center">
            <CardContent>
              <div className="mb-4 text-red-600">
                <Activity className="mx-auto mb-2 h-8 w-8" />
                Failed to load projects
              </div>
              <p className="mb-4 text-red-500">{error}</p>
              <Button onClick={fetchProjects} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent>
              <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No projects yet</h3>
              <p className="mb-4 text-gray-500">
                Get started by creating your first documentation project.
              </p>
              <Button onClick={createProject}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <Card key={project.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-500">
                    Last updated: {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
