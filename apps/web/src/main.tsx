import { AUTH_PROVIDER, ClerkProvider } from '@/lib/auth-provider';
import '@/lib/immer-config';
import React from 'react';
import ReactDOM from 'react-dom/client';
// React Router is handled inside App via RouterProvider

import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const isSimpleProvider = AUTH_PROVIDER === 'simple';

if (!isSimpleProvider && !publishableKey && import.meta.env.VITE_E2E !== 'true') {
  throw new Error('Missing Publishable Key');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {isSimpleProvider ? (
      <ClerkProvider>
        <App />
      </ClerkProvider>
    ) : (
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={{
          baseTheme: undefined,
          variables: {
            colorPrimary: '#3b82f6',
          },
        }}
      >
        <App />
      </ClerkProvider>
    )}
  </React.StrictMode>
);
