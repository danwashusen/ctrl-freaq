import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface DashboardShellSidebarArgs {
  closeSidebar: () => void;
  isCollapsed: boolean;
}

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  sidebar: (args: DashboardShellSidebarArgs) => ReactNode;
  children: ReactNode;
}

const LARGE_BREAKPOINT = '(min-width: 1024px)';

const resolveLargeViewportQuery = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  try {
    return window.matchMedia(LARGE_BREAKPOINT);
  } catch {
    return null;
  }
};

export default function DashboardShell({
  title,
  subtitle,
  headerActions,
  sidebar,
  children,
}: DashboardShellProps) {
  const [isLargeViewport, setIsLargeViewport] = useState<boolean>(() => {
    const mediaQuery = resolveLargeViewportQuery();
    return mediaQuery ? mediaQuery.matches : true;
  });
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);
  const wasSidebarOpenRef = useRef(false);
  const isSidebarOpen = useProjectStore(state => state.sidebarOpen);
  const setSidebarOpen = useProjectStore(state => state.setSidebarOpen);
  const setLastFocusedTrigger = useProjectStore(state => state.setLastFocusedTrigger);
  const clearLastFocusedTrigger = useProjectStore(state => state.clearLastFocusedTrigger);
  const lastFocusedTrigger = useProjectStore(state => state.lastFocusedTrigger);
  const sidebarCollapsed = useProjectStore(state => state.sidebarCollapsed);
  const collapsed = isLargeViewport && sidebarCollapsed;

  const focusFirstSidebarControl = useCallback(() => {
    const container = sidebarContainerRef.current;
    if (!container) {
      return;
    }
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, []);

  useEffect(() => {
    const mediaQuery = resolveLargeViewportQuery();
    if (!mediaQuery) {
      return;
    }
    const handleChange = () => setIsLargeViewport(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const body = typeof document !== 'undefined' ? document.body : null;
    if (!body) {
      return;
    }
    if (!isLargeViewport && isSidebarOpen) {
      body.style.setProperty('overflow', 'hidden');
    } else {
      body.style.removeProperty('overflow');
    }
  }, [isLargeViewport, isSidebarOpen]);

  useEffect(() => {
    const justClosed = wasSidebarOpenRef.current && !isSidebarOpen;
    wasSidebarOpenRef.current = isSidebarOpen;

    if (!isLargeViewport && isSidebarOpen) {
      focusFirstSidebarControl();
    }

    if (!isLargeViewport && justClosed) {
      const trigger = lastFocusedTrigger ?? toggleButtonRef.current;
      if (trigger) {
        trigger.focus();
      }
      clearLastFocusedTrigger();
    }
  }, [
    clearLastFocusedTrigger,
    focusFirstSidebarControl,
    isLargeViewport,
    isSidebarOpen,
    lastFocusedTrigger,
  ]);

  useEffect(() => {
    if (isLargeViewport) {
      setSidebarOpen(false);
      clearLastFocusedTrigger();
    }
  }, [clearLastFocusedTrigger, isLargeViewport, setSidebarOpen]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.removeProperty('overflow');
      }
      setSidebarOpen(false);
      clearLastFocusedTrigger();
    };
  }, [clearLastFocusedTrigger, setSidebarOpen]);

  const handleToggleSidebar = useCallback(() => {
    if (!isLargeViewport) {
      if (!isSidebarOpen && toggleButtonRef.current) {
        setLastFocusedTrigger(toggleButtonRef.current);
      }
      setSidebarOpen(!isSidebarOpen);
    }
  }, [isLargeViewport, isSidebarOpen, setLastFocusedTrigger, setSidebarOpen]);

  const handleCloseSidebar = useCallback(() => {
    if (!isLargeViewport) {
      setSidebarOpen(false);
    }
  }, [isLargeViewport, setSidebarOpen]);

  const handleSidebarKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isLargeViewport || !isSidebarOpen) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const container = sidebarContainerRef.current;
      if (!container) {
        return;
      }
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter(
        element => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden')
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }
      const isShift = event.shiftKey;
      const active = document.activeElement as HTMLElement | null;

      if (!isShift && active === last) {
        event.preventDefault();
        first.focus();
      } else if (isShift && active === first) {
        event.preventDefault();
        last.focus();
      }
    },
    [isLargeViewport, isSidebarOpen, setSidebarOpen]
  );

  const sidebarContent = useMemo(
    () =>
      sidebar({
        closeSidebar: handleCloseSidebar,
        isCollapsed: collapsed,
      }),
    [collapsed, handleCloseSidebar, sidebar]
  );

  return (
    <div
      className="dashboard-shell flex min-h-screen flex-col bg-[hsl(var(--dashboard-shell-bg))]"
      data-testid="dashboard-shell"
    >
      <header
        className="dashboard-shell__header relative overflow-hidden border-b border-[hsl(var(--dashboard-shell-border))] bg-[hsl(var(--dashboard-header-bg))] shadow-[0_8px_32px_rgba(20,16,31,0.45)]"
        role="banner"
      >
        <div
          aria-hidden="true"
          data-testid="dashboard-shell-header-gradient"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,_hsl(var(--dashboard-header-gradient-start))_0%,_hsl(var(--dashboard-header-gradient-end))_100%)] opacity-95"
        />
        <div
          className="relative flex h-16 w-full items-center justify-between px-[var(--dashboard-shell-gutter)]"
          data-testid="dashboard-shell-header-inner"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-[hsl(var(--dashboard-shell-border))] bg-[hsl(var(--dashboard-sidebar-bg))] px-2.5 py-2 text-sm font-medium text-[hsl(var(--dashboard-header-text))] shadow-sm transition hover:bg-[hsl(var(--dashboard-shell-hover-bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 lg:hidden"
              aria-expanded={isSidebarOpen}
              aria-controls="dashboard-shell-sidebar"
              aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={handleToggleSidebar}
              ref={toggleButtonRef}
              data-testid="dashboard-shell-toggle"
            >
              <span className="sr-only">
                {isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              </span>
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <ProductMark />
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-[hsl(var(--dashboard-header-text))]">
                {title}
              </span>
              {subtitle ? (
                <span
                  className="hidden text-sm text-[hsl(var(--dashboard-header-subtitle))] sm:inline"
                  data-testid="dashboard-shell-subtitle"
                >
                  {subtitle}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">{headerActions}</div>
        </div>
      </header>

      <div className="dashboard-shell__layout relative flex flex-1">
        {!isLargeViewport ? (
          <div
            className={cn(
              'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200',
              isSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            )}
            aria-hidden="true"
            onClick={handleCloseSidebar}
          />
        ) : null}

        <div
          id="dashboard-shell-sidebar"
          ref={sidebarContainerRef}
          className={cn(
            'dashboard-shell__sidebar relative z-50 flex h-full max-h-screen w-[var(--dashboard-sidebar-width-expanded)] flex-col overflow-y-auto overflow-x-hidden border-r border-[hsl(var(--dashboard-shell-border))] bg-[hsl(var(--dashboard-sidebar-bg))] pb-6 pt-6 shadow-lg transition-transform duration-200 ease-out lg:h-[calc(100vh-4rem)] lg:max-h-[calc(100vh-4rem)]',
            collapsed ? 'px-2 lg:px-3' : 'px-4',
            collapsed
              ? 'lg:w-[var(--dashboard-sidebar-width-collapsed)]'
              : 'lg:w-[var(--dashboard-sidebar-width-expanded)]',
            isLargeViewport
              ? 'sticky top-16 hidden translate-x-0 lg:block'
              : isSidebarOpen
                ? 'fixed inset-y-0 left-0 translate-x-0'
                : 'fixed inset-y-0 left-0 -translate-x-full'
          )}
          onKeyDown={handleSidebarKeyDown}
          data-testid="dashboard-shell-sidebar"
          data-collapsed={collapsed ? 'true' : 'false'}
        >
          <div
            aria-hidden="true"
            data-testid="dashboard-shell-sidebar-gradient"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_hsl(var(--dashboard-sidebar-gradient-start))_0%,_hsl(var(--dashboard-sidebar-gradient-end))_100%)] opacity-95"
          />
          <div className="relative z-10 flex h-full flex-col">{sidebarContent}</div>
        </div>

        <main
          role="main"
          className="dashboard-shell__main relative flex-1 bg-[hsl(var(--dashboard-content-bg))]"
        >
          <div
            data-testid="dashboard-shell-main-inner"
            className="w-full max-w-none"
            style={{
              paddingInline: 'var(--dashboard-shell-gutter)',
              paddingBlock: 'var(--dashboard-shell-padding-y)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function ProductMark() {
  return (
    <span
      aria-hidden="true"
      data-testid="dashboard-product-mark"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[hsl(var(--dashboard-product-mark-border))] bg-[radial-gradient(circle_at_20%_20%,_hsl(var(--dashboard-product-mark-glow))_0%,_transparent_70%)] text-base font-semibold tracking-tight text-[hsl(var(--dashboard-product-mark-text))] shadow-[0_10px_30px_rgba(124,58,237,0.35)]"
    >
      CF
    </span>
  );
}
