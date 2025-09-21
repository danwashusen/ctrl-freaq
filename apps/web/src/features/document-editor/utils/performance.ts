/**
 * Performance Optimization and Lazy Loading Utilities
 *
 * Provides optimization utilities for the Document Editor Core Infrastructure
 * to meet performance goals: <300ms section navigation, 60fps animations, <100ms patch generation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from './logger';

// Browser memory API interface (non-standard)
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

// Types
export interface PerformanceMetrics {
  navigationTime: number;
  patchGenerationTime: number;
  renderTime: number;
  memoryUsage: number;
  timestamp: number;
}

export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  threshold?: number;
}

export interface LazyLoadConfig {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private observers: ((metrics: PerformanceMetrics) => void)[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing a navigation operation
   */
  startNavigation(): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const navigationTime = endTime - startTime;

      this.recordMetric({
        navigationTime,
        patchGenerationTime: 0,
        renderTime: 0,
        memoryUsage: this.getMemoryUsage(),
        timestamp: Date.now(),
      });

      if (navigationTime > 300) {
        logger.warn(
          { operation: 'navigation', duration: navigationTime },
          `Navigation took ${navigationTime.toFixed(1)}ms (>300ms target)`
        );
      }
    };
  }

  /**
   * Start timing a patch generation operation
   */
  startPatchGeneration(): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const patchGenerationTime = endTime - startTime;

      this.recordMetric({
        navigationTime: 0,
        patchGenerationTime,
        renderTime: 0,
        memoryUsage: this.getMemoryUsage(),
        timestamp: Date.now(),
      });

      if (patchGenerationTime > 100) {
        logger.warn(
          { operation: 'patch_generation', duration: patchGenerationTime },
          `Patch generation took ${patchGenerationTime.toFixed(1)}ms (>100ms target)`
        );
      }
    };
  }

  /**
   * Start timing a render operation
   */
  startRender(): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      this.recordMetric({
        navigationTime: 0,
        patchGenerationTime: 0,
        renderTime,
        memoryUsage: this.getMemoryUsage(),
        timestamp: Date.now(),
      });
    };
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only last 100 metrics to avoid memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Notify observers
    this.observers.forEach(observer => observer(metric));
  }

  /**
   * Subscribe to performance metrics
   */
  subscribe(observer: (metrics: PerformanceMetrics) => void): () => void {
    this.observers.push(observer);

    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Get current memory usage (if available)
   */
  private getMemoryUsage(): number {
    const perfWithMemory = performance as PerformanceWithMemory;
    if (perfWithMemory.memory) {
      return perfWithMemory.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    avgNavigationTime: number;
    avgPatchGenerationTime: number;
    avgRenderTime: number;
    maxNavigationTime: number;
    maxPatchGenerationTime: number;
    violations: number;
  } {
    const navigationTimes = this.metrics.map(m => m.navigationTime).filter(t => t > 0);
    const patchTimes = this.metrics.map(m => m.patchGenerationTime).filter(t => t > 0);
    const renderTimes = this.metrics.map(m => m.renderTime).filter(t => t > 0);

    const violations = this.metrics.filter(
      m => m.navigationTime > 300 || m.patchGenerationTime > 100
    ).length;

    return {
      avgNavigationTime: navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length || 0,
      avgPatchGenerationTime: patchTimes.reduce((a, b) => a + b, 0) / patchTimes.length || 0,
      avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length || 0,
      maxNavigationTime: Math.max(...navigationTimes, 0),
      maxPatchGenerationTime: Math.max(...patchTimes, 0),
      violations,
    };
  }
}

// Debounce utility for performance optimization
export function debounce<Args extends readonly unknown[], Return>(
  func: (...args: Args) => Return,
  wait: number,
  immediate?: boolean
): (...args: Args) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

// Throttle utility for scroll and resize events
export function throttle<Args extends readonly unknown[], Return>(
  func: (...args: Args) => Return,
  limit: number
): (...args: Args) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>(
  items: T[],
  config: VirtualScrollConfig
): {
  containerProps: React.HTMLAttributes<HTMLDivElement>;
  visibleItems: Array<{ item: T; index: number; style: React.CSSProperties }>;
  scrollToIndex: (index: number) => void;
  totalHeight: number;
} {
  const [scrollTop, setScrollTop] = useState(0);
  const { itemHeight, containerHeight, overscan = 5 } = config;

  const containerRef = useRef<HTMLDivElement>(null);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const item = items[i];
    if (item) {
      visibleItems.push({
        item,
        index: i,
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          width: '100%',
          height: itemHeight,
        },
      });
    }
  }

  const totalHeight = items.length * itemHeight;

  const handleScroll = useMemo(
    () =>
      throttle((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
      }, 16), // 60fps
    [setScrollTop]
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      if (containerRef.current) {
        const targetScrollTop = index * itemHeight;
        containerRef.current.scrollTop = targetScrollTop;
        setScrollTop(targetScrollTop);
      }
    },
    [itemHeight]
  );

  const containerProps = {
    ref: containerRef,
    onScroll: handleScroll,
    style: {
      height: containerHeight,
      overflowY: 'auto' as const,
      position: 'relative' as const,
    },
  };

  return {
    containerProps,
    visibleItems,
    scrollToIndex,
    totalHeight,
  };
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  config: LazyLoadConfig = {}
): [(node: Element | null) => void, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const { threshold = 0.1, rootMargin = '50px', triggerOnce = true } = config;

  const ref = useCallback(
    (node: Element | null) => {
      if (!node) return;

      if (triggerOnce && hasTriggered) {
        setIsIntersecting(true);
        return;
      }

      const observer = new IntersectionObserver(
        entries => {
          const entry = entries[0];
          if (entry) {
            const isVisible = entry.isIntersecting;
            setIsIntersecting(isVisible);

            if (isVisible && triggerOnce) {
              setHasTriggered(true);
              observer.disconnect();
            }
          }
        },
        { threshold, rootMargin }
      );

      observer.observe(node);

      return () => observer.disconnect();
    },
    [threshold, rootMargin, triggerOnce, hasTriggered]
  );

  return [ref, isIntersecting || hasTriggered];
}

// Memory management utilities
export class MemoryManager {
  private static cleanupTasks: (() => void)[] = [];

  /**
   * Register a cleanup task to prevent memory leaks
   */
  static registerCleanup(cleanup: () => void): void {
    this.cleanupTasks.push(cleanup);
  }

  /**
   * Run all registered cleanup tasks
   */
  static cleanup(): void {
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        logger.warn(
          {
            operation: 'cleanup_task',
            error: error instanceof Error ? error.message : String(error),
          },
          'Cleanup task failed'
        );
      }
    });
    this.cleanupTasks = [];
  }

  /**
   * Monitor memory usage and warn if it grows too large
   */
  static startMemoryMonitoring(): () => void {
    const interval = setInterval(() => {
      const perfWithMemory = performance as PerformanceWithMemory;
      if (perfWithMemory.memory) {
        const memory = perfWithMemory.memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

        if (usedMB > limitMB * 0.9) {
          logger.warn(
            {
              operation: 'memory_monitoring',
              usedMemoryMB: usedMB,
              limitMemoryMB: limitMB,
            },
            `High memory usage: ${usedMB.toFixed(1)}MB of ${limitMB.toFixed(1)}MB`
          );
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }
}

// Image lazy loading utility
export function useLazyImage(
  src: string,
  config?: LazyLoadConfig
): {
  ref: (node: Element | null) => void;
  isLoaded: boolean;
  imageSrc: string | undefined;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | undefined>();
  const [ref, isVisible] = useIntersectionObserver(config);

  useEffect(() => {
    if (isVisible && !isLoaded && src) {
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
      };
      img.onerror = () => {
        logger.warn(
          { operation: 'image_load', error: 'load_failed' },
          `Failed to load image: ${src}`
        );
        setIsLoaded(true); // Mark as "loaded" to prevent retry loops
      };
      img.src = src;
    }
  }, [isVisible, isLoaded, src]);

  return { ref, isLoaded, imageSrc };
}

// Animation frame utilities for 60fps performance
export class AnimationManager {
  private static rafId: number | null = null;
  private static callbacks: (() => void)[] = [];

  /**
   * Schedule a callback for the next animation frame
   */
  static schedule(callback: () => void): void {
    this.callbacks.push(callback);

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        const callbacks = [...this.callbacks];
        this.callbacks = [];
        this.rafId = null;

        callbacks.forEach(cb => {
          try {
            cb();
          } catch (error) {
            logger.warn(
              {
                operation: 'animation_callback',
                error: error instanceof Error ? error.message : 'unknown',
              },
              'Animation callback failed'
            );
          }
        });
      });
    }
  }

  /**
   * Cancel all scheduled animations
   */
  static cancelAll(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callbacks = [];
  }
}

// Bundle optimization utilities
export function preloadRoute(routePath: string): Promise<void> {
  // Dynamic import preloading for route-based code splitting
  return import(/* webpackChunkName: "[request]" */ `../${routePath}`)
    .then(() => {
      logger.info({ operation: 'route_preload', routePath }, `Preloaded route: ${routePath}`);
    })
    .catch(error => {
      logger.warn(
        { operation: 'route_preload', routePath, error: error.message },
        `Failed to preload route ${routePath}`
      );
    });
}

// Performance hooks
export function usePerformanceMonitoring(): {
  startNavigation: () => () => void;
  startPatchGeneration: () => () => void;
  startRender: () => () => void;
  metrics: PerformanceMetrics | null;
} {
  const [currentMetric, setCurrentMetric] = useState<PerformanceMetrics | null>(null);
  const monitor = PerformanceMonitor.getInstance();

  useEffect(() => {
    const unsubscribe = monitor.subscribe(setCurrentMetric);
    return unsubscribe;
  }, [monitor]);

  return {
    startNavigation: () => monitor.startNavigation(),
    startPatchGeneration: () => monitor.startPatchGeneration(),
    startRender: () => monitor.startRender(),
    metrics: currentMetric,
  };
}

// Export performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Export memory manager
export { MemoryManager as memoryManager };

// Export animation manager
export { AnimationManager as animationManager };

// Default optimization settings
export const PERFORMANCE_CONFIG = {
  NAVIGATION_TARGET_MS: 300,
  PATCH_GENERATION_TARGET_MS: 100,
  ANIMATION_TARGET_FPS: 60,
  SCROLL_THROTTLE_MS: 16, // 60fps
  DEBOUNCE_DELAY_MS: 300,
  VIRTUAL_SCROLL_OVERSCAN: 5,
  LAZY_LOAD_THRESHOLD: 0.1,
  LAZY_LOAD_ROOT_MARGIN: '50px',
  MEMORY_WARNING_THRESHOLD: 0.9,
} as const;
