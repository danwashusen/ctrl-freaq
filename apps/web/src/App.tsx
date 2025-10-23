import { SignedIn, SignedOut, RedirectToSignIn, useUser } from '@/lib/auth-provider';
import { useEffect, useMemo } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import Settings from './pages/Settings';

import { Toaster } from './components/ui/toaster';
import { ApiProvider } from './lib/api-context';
import logger from './lib/logger';
import { documentRoutes } from './app/router/document-routes';
import { SimpleAuthWarningBanner } from './components/simple-auth/SimpleAuthWarningBanner';

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
    if (typeof window === 'undefined') {
      return;
    }

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

  const router = useMemo(
    () =>
      createBrowserRouter([
        { path: '/', element: <Navigate to="/dashboard" replace /> },
        { path: '/dashboard', element: <Dashboard /> },
        { path: '/project/:id', element: <Project /> },
        { path: '/settings', element: <Settings /> },
        ...documentRoutes,
        { path: '*', element: <Navigate to="/dashboard" replace /> },
      ]),
    []
  );

  return (
    <div className="bg-background min-h-screen">
      <SimpleAuthWarningBanner />
      <SignedIn>
        <ApiProvider>
          <RouterProvider router={router} />
        </ApiProvider>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn signInFallbackRedirectUrl="/dashboard" />
      </SignedOut>

      <Toaster />
    </div>
  );
}

export default App;
