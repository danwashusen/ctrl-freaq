/**
 * Template utilities and helpers
 */

import { watch } from 'chokidar';
import { EventEmitter } from 'events';

/**
 * Template file watcher for hot reloading
 */
export class TemplateWatcher extends EventEmitter {
  private watcher?: any;
  private watchedPaths = new Set<string>();

  /**
   * Start watching template files
   */
  watch(paths: string | string[], options: { ignored?: string[]; persistent?: boolean } = {}): void {
    const pathsArray = Array.isArray(paths) ? paths : [paths];

    this.watcher = watch(pathsArray, {
      ignored: options.ignored || ['**/node_modules/**', '**/.git/**'],
      persistent: options.persistent !== false,
      ignoreInitial: true
    });

    this.watcher
      .on('change', (path: string) => {
        this.emit('change', path);
      })
      .on('add', (path: string) => {
        this.emit('add', path);
      })
      .on('unlink', (path: string) => {
        this.emit('remove', path);
      })
      .on('error', (error: Error) => {
        this.emit('error', error);
      });

    pathsArray.forEach(path => this.watchedPaths.add(path));
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.watchedPaths.clear();
  }

  /**
   * Get watched paths
   */
  getWatchedPaths(): string[] {
    return Array.from(this.watchedPaths);
  }
}

/**
 * Template caching utility
 */
export class TemplateCache {
  private cache = new Map<string, { content: any; timestamp: number }>();
  private maxAge: number;
  private maxSize: number;

  constructor(options: { maxAge?: number; maxSize?: number } = {}) {
    this.maxAge = options.maxAge || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 100; // 100 templates max
  }

  /**
   * Get cached template
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.content;
  }

  /**
   * Set cached template
   */
  set(key: string, content: any): void {
    // Remove oldest entries if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      content,
      timestamp: Date.now()
    });
  }

  /**
   * Remove from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Template path utilities
 */
export class TemplatePathUtils {
  /**
   * Resolve template path with extensions
   */
  static resolvePath(basePath: string, templateName: string): string {
    const path = require('path');
    const extensions = ['.yaml', '.yml', '.template', ''];

    for (const ext of extensions) {
      const fullPath = path.resolve(basePath, `${templateName}${ext}`);
      if (require('fs').existsSync(fullPath)) {
        return fullPath;
      }
    }

    throw new Error(`Template '${templateName}' not found in '${basePath}'`);
  }

  /**
   * Get template name from file path
   */
  static getTemplateName(filePath: string): string {
    const path = require('path');
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * List template files in directory
   */
  static listTemplates(directory: string): string[] {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(directory)) {
      return [];
    }

    return fs.readdirSync(directory)
      .filter((file: string) => /\.(yaml|yml|template)$/i.test(file))
      .map((file: string) => path.join(directory, file));
  }
}

/**
 * Template transformation utilities
 */
export class TemplateTransformUtils {
  /**
   * Convert template format (e.g., from Handlebars to Mustache)
   */
  static convertSyntax(content: string, fromFormat: string, toFormat: string): string {
    if (fromFormat === toFormat) {
      return content;
    }

    let converted = content;

    // Basic Handlebars to Mustache conversion
    if (fromFormat === 'handlebars' && toFormat === 'mustache') {
      // Convert {{#if condition}} to {{#condition}}
      converted = converted.replace(/\{\{#if\s+([^}]+)\}\}/g, '{{#$1}}');
      converted = converted.replace(/\{\{\/if\}\}/g, '{{/$1}}');

      // Convert {{#unless condition}} to {{^condition}}
      converted = converted.replace(/\{\{#unless\s+([^}]+)\}\}/g, '{{^$1}}');
      converted = converted.replace(/\{\{\/unless\}\}/g, '{{/$1}}');

      // Convert {{#each items}} to {{#items}}
      converted = converted.replace(/\{\{#each\s+([^}]+)\}\}/g, '{{#$1}}');
      converted = converted.replace(/\{\{\/each\}\}/g, '{{/$1}}');
    }

    return converted;
  }

  /**
   * Minify template content
   */
  static minify(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .trim();
  }

  /**
   * Prettify template content
   */
  static prettify(content: string, indentSize: number = 2): string {
    // Basic prettification - would use a proper formatter in production
    const indent = ' '.repeat(indentSize);
    let result = '';
    let depth = 0;

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Decrease depth for closing tags
      if (trimmed.startsWith('{{/') || trimmed.startsWith('{{^')) {
        depth = Math.max(0, depth - 1);
      }

      result += indent.repeat(depth) + trimmed + '\n';

      // Increase depth for opening tags
      if (trimmed.startsWith('{{#') && !trimmed.includes('{{/')){
        depth++;
      }
    }

    return result.trim();
  }
}

/**
 * Template performance utilities
 */
export class TemplatePerformanceUtils {
  private static renderTimes = new Map<string, number[]>();

  /**
   * Track template render time
   */
  static trackRenderTime(templateName: string, duration: number): void {
    if (!this.renderTimes.has(templateName)) {
      this.renderTimes.set(templateName, []);
    }

    const times = this.renderTimes.get(templateName)!;
    times.push(duration);

    // Keep only last 100 render times
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * Get render statistics for template
   */
  static getRenderStats(templateName: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    recent: number;
  } | null {
    const times = this.renderTimes.get(templateName);
    if (!times || times.length === 0) {
      return null;
    }

    return {
      count: times.length,
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      recent: times[times.length - 1] || 0
    };
  }

  /**
   * Get all render statistics
   */
  static getAllRenderStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [templateName] of this.renderTimes.entries()) {
      stats[templateName] = this.getRenderStats(templateName);
    }

    return stats;
  }

  /**
   * Clear render statistics
   */
  static clearStats(templateName?: string): void {
    if (templateName) {
      this.renderTimes.delete(templateName);
    } else {
      this.renderTimes.clear();
    }
  }
}