# CTRL FreaQ Frontend Architecture Document

## Template and Framework Selection

### Architectural Decision: React Frontend with SvelteKit Backend

After analyzing the existing codebase and project requirements, this architecture adopts a **decoupled frontend approach** using React as the primary UI framework while maintaining SvelteKit as the backend API server. This decision is based on:

1. **Existing UI Investment**: Substantial React-based UI foundation exists in `/tmp/ctrl-freaq-ui` with established patterns, components, and routing
2. **Ecosystem Alignment**: React's extensive ecosystem for WYSIWYG editors (Milkdown), real-time features, and component libraries (shadcn/ui)
3. **Team Expertise**: React's widespread adoption ensures easier onboarding and AI agent compatibility
4. **Clear Separation of Concerns**: Decoupling frontend from backend enables independent scaling and deployment

The SvelteKit application will transition to a **pure API server role**, exposing REST endpoints and SSE streams consumed by the React frontend. This maintains the backend architecture's integrity while leveraging React's strengths for complex UI interactions.

### Frontend Starter Analysis

**Foundation Used**: Custom React + TypeScript setup based on lovable.ai generated code
- **Location**: `/tmp/ctrl-freaq-ui`
- **Key Technologies**: React 18, TypeScript, Vite, React Router v6, Clerk, shadcn/ui, TanStack Query
- **Constraints**: Must maintain compatibility with existing component patterns and routing structure

### Assumptions and Resolutions

| Assumption | Resolution |
|------------|------------|
| Frontend framework choice conflicts with backend | Use React for UI, SvelteKit for API only |
| Document Editor complexity requires framework alignment | Milkdown works excellently with React |
| Authentication must be consistent | Clerk SDK available for both React and SvelteKit |
| Streaming AI responses need special handling | React supports SSE/WebStreams natively |
| Library-first architecture applies to frontend | Create React component libraries with Storybook documentation |

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-09-12 | 1.0 | Initial frontend architecture with React/SvelteKit decoupling | Architect |

## Frontend Tech Stack

### Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Framework | React | 18.3.x | UI framework | Existing investment, ecosystem, AI agent familiarity |
| UI Library | shadcn/ui | latest | Component library | Radix UI based, fully customizable, TypeScript native |
| State Management | TanStack Query + Zustand | 5.x / 4.5.x | Server + client state | Excellent DX, built-in caching, minimal boilerplate |
| Routing | React Router | 6.x | Client-side routing | Industry standard, existing implementation |
| Build Tool | Vite | 5.x | Build and dev server | Fast HMR, ESM native, excellent DX |
| Styling | Tailwind CSS | 3.4.x | Utility-first CSS | Rapid development, consistent design system |
| Testing | Vitest + React Testing Library | 1.x / 14.x | Unit and integration testing | Vite native, excellent React support |
| Component Library | shadcn/ui | latest | UI components | Accessible, customizable, TypeScript first |
| Form Handling | React Hook Form + Zod | 7.x / 3.x | Form state and validation | Performance, TypeScript integration |
| Animation | Framer Motion | 11.x | Animations and transitions | Declarative API, gesture support |
| Dev Tools | React DevTools + Vite Plugin | latest | Development experience | Debugging, performance profiling |

## Project Structure

```plaintext
src/
├── app/                        # Application shell and providers
│   ├── providers/             # Context providers and wrappers
│   │   ├── auth-provider.tsx
│   │   ├── query-provider.tsx
│   │   ├── theme-provider.tsx
│   │   └── index.tsx
│   ├── router/                # Routing configuration
│   │   ├── routes.tsx
│   │   ├── protected-route.tsx
│   │   └── index.tsx
│   └── App.tsx
├── features/                  # Feature-based modules (Constitutional library-first)
│   ├── document-editor/      # Document editing feature
│   │   ├── components/
│   │   │   ├── editor-toolbar.tsx
│   │   │   ├── milkdown-editor.tsx
│   │   │   ├── section-navigator.tsx
│   │   │   └── diff-viewer.tsx
│   │   ├── hooks/
│   │   │   ├── use-editor-state.ts
│   │   │   ├── use-patch-engine.ts
│   │   │   └── use-pending-changes.ts
│   │   ├── services/
│   │   │   ├── editor-api.ts
│   │   │   └── patch-service.ts
│   │   ├── stores/
│   │   │   └── editor-store.ts
│   │   └── index.ts
│   ├── assumptions/          # Assumptions resolution
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   ├── ai-chat/             # AI collaboration features
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── quality-gates/       # QA and validation
│       ├── components/
│       ├── hooks/
│       └── services/
├── components/               # Shared UI components
│   ├── ui/                  # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── [other shadcn components]
│   ├── layout/             # Layout components
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── common/             # Common components
│       ├── error-boundary.tsx
│       ├── loading-spinner.tsx
│       └── empty-state.tsx
├── pages/                   # Route pages
│   ├── dashboard/
│   │   └── index.tsx
│   ├── projects/
│   │   ├── [projectId]/
│   │   │   └── index.tsx
│   │   └── index.tsx
│   ├── documents/
│   │   ├── [documentId]/
│   │   │   ├── edit.tsx
│   │   │   └── index.tsx
│   │   └── new.tsx
│   └── auth/
│       ├── sign-in.tsx
│       └── sign-up.tsx
├── lib/                     # Core utilities (Constitutional library requirement)
│   ├── api/                # API client configuration
│   │   ├── client.ts
│   │   ├── endpoints.ts
│   │   └── types.ts
│   ├── streaming/          # SSE/WebStream utilities
│   │   ├── sse-client.ts
│   │   └── stream-parser.ts
│   ├── utils/              # Utility functions
│   │   ├── cn.ts
│   │   └── format.ts
│   └── constants/          # App constants
│       └── config.ts
├── hooks/                   # Global hooks
│   ├── use-auth.ts
│   ├── use-toast.ts
│   └── use-debounce.ts
├── stores/                  # Global state stores
│   ├── auth-store.ts
│   ├── project-store.ts
│   └── ui-store.ts
├── styles/                  # Global styles
│   ├── globals.css
│   └── themes/
│       ├── light.css
│       └── dark.css
├── types/                   # TypeScript type definitions
│   ├── api.ts
│   ├── models.ts
│   └── global.d.ts
└── test/                    # Test utilities
    ├── setup.ts
    ├── mocks/
    └── fixtures/
```

## Component Standards

### Component Template

```typescript
// src/features/[feature]/components/[component-name].tsx
import { FC, memo, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ComponentNameProps {
  className?: string;
  children?: React.ReactNode;
  // Add specific props with JSDoc comments
  /** Handler called when action occurs */
  onAction?: (value: string) => void;
}

/**
 * ComponentName - Brief description of component purpose
 * 
 * @example
 * ```tsx
 * <ComponentName onAction={handleAction}>
 *   Content
 * </ComponentName>
 * ```
 */
export const ComponentName: FC<ComponentNameProps> = memo(({
  className,
  children,
  onAction,
}) => {
  const [state, setState] = useState<string>('');

  const handleClick = useCallback((value: string) => {
    setState(value);
    onAction?.(value);
  }, [onAction]);

  return (
    <div className={cn('component-base-styles', className)}>
      {children}
    </div>
  );
});

ComponentName.displayName = 'ComponentName';
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `DocumentEditor.tsx` |
| Component files | kebab-case or PascalCase | `document-editor.tsx` or `DocumentEditor.tsx` |
| Hooks | camelCase with 'use' prefix | `useDocumentState.ts` |
| Services | camelCase with 'Service' suffix | `documentService.ts` |
| Stores | camelCase with 'Store' suffix | `editorStore.ts` |
| Types/Interfaces | PascalCase | `DocumentState`, `EditorConfig` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |
| CSS classes | kebab-case | `editor-toolbar` |
| Test files | [name].test.tsx | `DocumentEditor.test.tsx` |

## State Management

### Store Structure

```plaintext
src/stores/
├── auth-store.ts           # Authentication state
├── project-store.ts        # Project management
├── document-store.ts       # Document state
├── editor-store.ts         # Editor specific state
└── ui-store.ts            # UI preferences and state
```

### State Management Template

```typescript
// src/stores/document-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface Document {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'ready' | 'published';
  sections: Section[];
}

interface DocumentStore {
  // State
  documents: Record<string, Document>;
  activeDocumentId: string | null;
  pendingChanges: Record<string, PatchDiff[]>;

  // Computed getters
  get activeDocument(): Document | null;
  
  // Actions
  setActiveDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  addPendingChange: (documentId: string, patch: PatchDiff) => void;
  clearPendingChanges: (documentId: string) => void;
  
  // Async actions (integrate with API)
  fetchDocument: (id: string) => Promise<void>;
  saveDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        documents: {},
        activeDocumentId: null,
        pendingChanges: {},

        // Computed getters
        get activeDocument() {
          const state = get();
          return state.activeDocumentId 
            ? state.documents[state.activeDocumentId] 
            : null;
        },

        // Synchronous actions
        setActiveDocument: (id) => set((state) => {
          state.activeDocumentId = id;
        }),

        updateDocument: (id, updates) => set((state) => {
          if (state.documents[id]) {
            Object.assign(state.documents[id], updates);
          }
        }),

        addPendingChange: (documentId, patch) => set((state) => {
          if (!state.pendingChanges[documentId]) {
            state.pendingChanges[documentId] = [];
          }
          state.pendingChanges[documentId].push(patch);
        }),

        clearPendingChanges: (documentId) => set((state) => {
          delete state.pendingChanges[documentId];
        }),

        // Async actions
        fetchDocument: async (id) => {
          const response = await documentApi.getDocument(id);
          set((state) => {
            state.documents[id] = response.data;
          });
        },

        saveDocument: async (id) => {
          const document = get().documents[id];
          const patches = get().pendingChanges[id] || [];
          
          await documentApi.saveDocument(id, { document, patches });
          
          set((state) => {
            state.clearPendingChanges(id);
          });
        },
      })),
      {
        name: 'document-storage',
        partialize: (state) => ({
          pendingChanges: state.pendingChanges,
        }),
      }
    )
  )
);
```

## API Integration

### Service Template

```typescript
// src/lib/api/services/document-service.ts
import { apiClient } from '@/lib/api/client';
import { Document, Section, Assumption, Proposal } from '@/types/models';

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}

class DocumentService {
  private baseUrl = '/api/v1/documents';

  /**
   * Fetch a document by ID
   */
  async getDocument(id: string): Promise<Document> {
    return apiClient.get<Document>(`${this.baseUrl}/${id}`);
  }

  /**
   * Create a new document
   */
  async createDocument(data: {
    type: 'architecture' | 'prd' | 'ui';
    title: string;
    templateId: string;
  }): Promise<Document> {
    return apiClient.post<Document>(this.baseUrl, data);
  }

  /**
   * Update document with patches
   */
  async updateDocument(
    id: string,
    patches: PatchDiff[]
  ): Promise<Document> {
    return apiClient.patch<Document>(`${this.baseUrl}/${id}`, { patches });
  }

  /**
   * Stream AI proposals for a section
   */
  streamProposals(
    sectionId: string,
    context: ProposalContext,
    onChunk: (chunk: ProposalChunk) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): () => void {
    const eventSource = new EventSource(
      `/api/v1/sections/${sectionId}/proposals.generate`,
      {
        withCredentials: true,
      }
    );

    eventSource.onmessage = (event) => {
      try {
        const chunk = JSON.parse(event.data) as ProposalChunk;
        onChunk(chunk);
      } catch (error) {
        console.error('Failed to parse proposal chunk:', error);
      }
    };

    eventSource.onerror = (error) => {
      onError(new Error('Proposal stream failed'));
      eventSource.close();
    };

    eventSource.addEventListener('complete', () => {
      onComplete();
      eventSource.close();
    });

    // Return cleanup function
    return () => eventSource.close();
  }

  /**
   * Run quality gates
   */
  async runQualityGates(documentId: string): Promise<QualityGateResult> {
    return apiClient.post<QualityGateResult>(
      `${this.baseUrl}/${documentId}/gates.run`
    );
  }
}

export const documentService = new DocumentService();
```

### API Client Configuration

```typescript
// src/lib/api/client.ts
import { getAuth } from '@clerk/clerk-react';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  private async getHeaders(): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...this.config.headers,
    });

    // Add Clerk authentication token
    try {
      const { getToken } = getAuth();
      const token = await getToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        code: 'unknown_error',
        message: 'An unexpected error occurred',
      }));
      
      throw new ApiError(
        error.code || 'unknown_error',
        error.message || response.statusText,
        response.status,
        error.details,
        error.requestId
      );
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.config.baseURL}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'PATCH',
      headers: await this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }
}

// Export configured instance
export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173',
});

// Custom error class
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## Routing

### Route Configuration

```typescript
// src/app/router/routes.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './protected-route';
import { LoadingSpinner } from '@/components/common/loading-spinner';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('@/pages/dashboard'));
const ProjectList = lazy(() => import('@/pages/projects'));
const ProjectDetail = lazy(() => import('@/pages/projects/[projectId]'));
const DocumentEditor = lazy(() => import('@/pages/documents/[documentId]/edit'));
const DocumentView = lazy(() => import('@/pages/documents/[documentId]'));
const NewDocument = lazy(() => import('@/pages/documents/new'));
const SignIn = lazy(() => import('@/pages/auth/sign-in'));
const SignUp = lazy(() => import('@/pages/auth/sign-up'));

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/auth/sign-in" element={<SignIn />} />
        <Route path="/auth/sign-up" element={<SignUp />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Projects */}
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          
          {/* Documents */}
          <Route path="/documents/new" element={<NewDocument />} />
          <Route path="/documents/:documentId" element={<DocumentView />} />
          <Route path="/documents/:documentId/edit" element={<DocumentEditor />} />
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

// Protected route wrapper
// src/app/router/protected-route.tsx
import { useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export const ProtectedRoute = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
```

## Styling Guidelines

### Styling Approach

The project uses **Tailwind CSS** for utility-first styling combined with **shadcn/ui** components. This approach provides:

1. **Rapid Development**: Utility classes for quick prototyping
2. **Consistency**: Design tokens enforced through Tailwind config
3. **Customization**: shadcn/ui components are fully customizable
4. **Performance**: PurgeCSS removes unused styles in production
5. **Dark Mode**: Built-in dark mode support with CSS variables

### Global Theme Variables

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Colors */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    
    --ring: 222.2 84% 4.9%;
    
    /* Spacing */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    --spacing-2xl: 3rem;
    --spacing-3xl: 4rem;
    
    /* Typography */
    --font-sans: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;
    --text-3xl: 1.875rem;
    --text-4xl: 2.25rem;
    
    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
    
    /* Border Radius */
    --radius: 0.5rem;
    --radius-sm: 0.25rem;
    --radius-md: 0.375rem;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;
    --radius-2xl: 1rem;
    --radius-full: 9999px;
    
    /* Animation */
    --animation-fast: 150ms;
    --animation-base: 250ms;
    --animation-slow: 350ms;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer utilities {
  /* Custom utilities */
  .animate-in {
    animation-duration: var(--animation-base);
    animation-fill-mode: both;
  }
  
  .fade-in {
    animation-name: fadeIn;
  }
  
  .slide-in-from-top {
    animation-name: slideInFromTop;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInFromTop {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
}
```

## Testing Requirements

### Component Test Template

```typescript
// src/features/document-editor/components/__tests__/DocumentEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentEditor } from '../DocumentEditor';
import { documentService } from '@/lib/api/services/document-service';

// Mock API service
vi.mock('@/lib/api/services/document-service');

// Test utilities
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('DocumentEditor', () => {
  const mockDocument = {
    id: 'doc-1',
    title: 'Test Document',
    content: '# Test Content',
    status: 'draft' as const,
    sections: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(documentService.getDocument).mockResolvedValue(mockDocument);
  });

  it('renders document editor with content', async () => {
    render(
      <DocumentEditor documentId="doc-1" />,
      { wrapper: createWrapper() }
    );

    // Wait for document to load
    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    // Verify editor components
    expect(screen.getByRole('textbox', { name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /sections/i })).toBeInTheDocument();
  });

  it('handles user text input', async () => {
    const user = userEvent.setup();
    
    render(
      <DocumentEditor documentId="doc-1" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    const editor = screen.getByRole('textbox', { name: /editor/i });
    await user.type(editor, 'New content');

    expect(editor).toHaveValue(expect.stringContaining('New content'));
  });

  it('saves document on save button click', async () => {
    const user = userEvent.setup();
    vi.mocked(documentService.updateDocument).mockResolvedValue({
      ...mockDocument,
      content: 'Updated content',
    });

    render(
      <DocumentEditor documentId="doc-1" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    // Make changes
    const editor = screen.getByRole('textbox', { name: /editor/i });
    await user.clear(editor);
    await user.type(editor, 'Updated content');

    // Click save
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Verify API call
    await waitFor(() => {
      expect(documentService.updateDocument).toHaveBeenCalledWith(
        'doc-1',
        expect.any(Array) // patches
      );
    });
  });

  it('displays error when document fails to load', async () => {
    const error = new Error('Failed to load document');
    vi.mocked(documentService.getDocument).mockRejectedValue(error);

    render(
      <DocumentEditor documentId="doc-1" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load document/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Best Practices

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test critical user flows (using Cypress/Playwright)
4. **Coverage Goals**: Aim for 80% code coverage
5. **Test Structure**: Arrange-Act-Assert pattern
6. **Mock External Dependencies**: API calls, routing, state management

## Environment Configuration

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:5173
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_ENABLE_MOCK_API=false
VITE_LOG_LEVEL=debug
VITE_SSE_TIMEOUT=30000
VITE_MAX_FILE_SIZE=10485760
VITE_ENABLE_DEV_TOOLS=true

# .env.production
VITE_API_BASE_URL=https://api.ctrl-freaq.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_ENABLE_MOCK_API=false
VITE_LOG_LEVEL=error
VITE_SSE_TIMEOUT=60000
VITE_MAX_FILE_SIZE=52428800
VITE_ENABLE_DEV_TOOLS=false

# .env.test
VITE_API_BASE_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_mock
VITE_ENABLE_MOCK_API=true
VITE_LOG_LEVEL=silent
VITE_SSE_TIMEOUT=5000
VITE_MAX_FILE_SIZE=1048576
VITE_ENABLE_DEV_TOOLS=false
```

## Frontend Developer Standards

### Critical Coding Rules

1. **Never commit sensitive data** - Use environment variables for all secrets
2. **Always use TypeScript** - No `any` types except when absolutely necessary
3. **Component composition over inheritance** - Use hooks and composition patterns
4. **Immutable state updates** - Never mutate state directly, use Immer in Zustand
5. **Error boundaries for all features** - Wrap feature components in error boundaries
6. **Memoize expensive computations** - Use `useMemo` and `useCallback` appropriately
7. **Lazy load route components** - Use React.lazy for code splitting
8. **Validate all API responses** - Use Zod schemas for runtime validation
9. **Handle loading and error states** - Every async operation needs UI feedback
10. **Test user interactions** - Focus on testing what users do, not implementation
11. **Use semantic HTML** - Proper ARIA labels and keyboard navigation
12. **Optimize bundle size** - Monitor with Bundle Analyzer, tree-shake imports

### Quick Reference

#### Common Commands
```bash
# Development
npm run dev              # Start dev server (Vite)
npm run build           # Build for production
npm run preview         # Preview production build
npm run type-check      # Run TypeScript compiler
npm run lint            # Run ESLint
npm run format          # Run Prettier
npm test                # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run storybook       # Start Storybook

# Code generation
npm run generate:component   # Generate component boilerplate
npm run generate:feature    # Generate feature module
npm run generate:api        # Generate API service
```

#### Key Import Patterns
```typescript
// Components
import { Button } from '@/components/ui/button';
import { DocumentEditor } from '@/features/document-editor';

// Hooks
import { useAuth } from '@/hooks/use-auth';
import { useDocumentStore } from '@/stores/document-store';

// Services
import { documentService } from '@/lib/api/services/document-service';

// Utils
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/format';

// Types
import type { Document } from '@/types/models';
```

#### File Naming Conventions
```
components/
  Button.tsx              # Component
  button.test.tsx        # Test
  button.stories.tsx     # Storybook
  
hooks/
  use-auth.ts            # Hook
  use-auth.test.ts       # Test
  
services/
  document-service.ts    # Service
  document-service.test.ts # Test
```

#### Project-Specific Patterns
```typescript
// Feature module export pattern
// features/document-editor/index.ts
export { DocumentEditor } from './components/DocumentEditor';
export { useEditorState } from './hooks/use-editor-state';
export type { EditorConfig } from './types';

// API error handling pattern
try {
  const document = await documentService.getDocument(id);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.code === 'not_found') {
      // Handle not found
    }
  }
  // Generic error handling
}

// Streaming response pattern
const cleanup = documentService.streamProposals(
  sectionId,
  context,
  (chunk) => {
    // Handle chunk
  },
  () => {
    // Handle complete
  },
  (error) => {
    // Handle error
  }
);

// Cleanup on unmount
useEffect(() => {
  return cleanup;
}, []);
```

---

## Integration with SvelteKit Backend

The React frontend communicates with the SvelteKit backend through:

1. **REST APIs** at `/api/v1/*` endpoints
2. **Server-Sent Events (SSE)** for streaming AI responses
3. **WebSocket** connections for real-time collaboration (Phase 2)

All API calls include Clerk authentication tokens and follow the error handling patterns defined in the backend architecture document.

## Constitutional Compliance

This frontend architecture maintains alignment with Constitutional requirements:

- **Library-First**: Features organized as standalone modules with clear boundaries
- **CLI Interfaces**: Component generation scripts and development tools
- **Test-First Development**: Testing templates and patterns enforced
- **Observability**: Comprehensive error tracking and performance monitoring
- **Simplicity**: Minimal abstraction, composition over inheritance