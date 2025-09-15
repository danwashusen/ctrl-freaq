import { SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import Settings from './pages/Settings';

import { Toaster } from '@/components/ui/toaster';
import { ApiProvider } from '@/lib/api-context';
import logger from '@/lib/logger';

function App() {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      logger.setUserId(user.id);
      logger.info('User authenticated', {
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      });
    }
  }, [user]);

  useEffect(() => {
    logger.info('Application started', {
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    const handleError = (event: ErrorEvent) => {
      logger.error(
        'Unhandled error',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        new Error(event.message)
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection', {
        reason: event.reason,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <SignedIn>
        <ApiProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/project/:id" element={<Project />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ApiProvider>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      <Toaster />
    </div>
  );
}

export default App;
