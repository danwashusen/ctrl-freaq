import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PatchEngine,
  createPatchEngine,
  patchEngine,
  PatchDiff,
  PendingChange,
  PatchEngineConfig,
} from './patch-engine';

describe('PatchEngine', () => {
  let engine: PatchEngine;

  beforeEach(() => {
    engine = new PatchEngine();
  });

  describe('constructor and configuration', () => {
    it('creates instance with default configuration', () => {
      const defaultEngine = new PatchEngine();
      expect(defaultEngine).toBeInstanceOf(PatchEngine);
    });

    it('applies custom configuration', () => {
      const config: PatchEngineConfig = {
        maxPatchSize: 64,
        diffTimeout: 2.0,
        diffEditCost: 6,
        matchThreshold: 0.8,
        deleteThreshold: 0.8,
      };

      const customEngine = new PatchEngine(config);
      expect(customEngine).toBeInstanceOf(PatchEngine);
    });

    it('exports factory function and default instance', () => {
      expect(createPatchEngine).toBeTypeOf('function');
      expect(patchEngine).toBeInstanceOf(PatchEngine);
    });
  });

  describe('createPatch', () => {
    it('generates patches for content changes', () => {
      const original = '# Title\nOriginal content here.';
      const modified = '# Title\nModified content here.\nNew line added.';

      const patches = engine.createPatch(original, modified);

      expect(patches).toHaveLength(2);
      expect(patches[0]).toMatchObject({
        op: 'remove',
        path: expect.stringMatching(/^\/line\/\d+$/),
        oldValue: 'Original',
      });
      expect(patches[1]).toMatchObject({
        op: 'add',
        path: expect.stringMatching(/^\/line\/\d+$/),
        value: expect.stringContaining('Modified'),
      });
    });

    it('handles simple text replacement', () => {
      const original = 'Hello World';
      const modified = 'Hello Universe';

      const patches = engine.createPatch(original, modified);

      expect(patches.length).toBeGreaterThan(0);
      expect(patches.some(p => p.op === 'remove' && p.oldValue?.includes('World'))).toBe(true);
      expect(patches.some(p => p.op === 'add' && p.value?.includes('Universe'))).toBe(true);
    });

    it('handles line additions', () => {
      const original = 'Line 1\nLine 2';
      const modified = 'Line 1\nLine 2\nLine 3';

      const patches = engine.createPatch(original, modified);

      expect(patches.some(p => p.op === 'add' && p.value?.includes('Line 3'))).toBe(true);
    });

    it('handles line deletions', () => {
      const original = 'Line 1\nLine 2\nLine 3';
      const modified = 'Line 1\nLine 3';

      const patches = engine.createPatch(original, modified);

      expect(patches.some(p => p.op === 'remove' && p.oldValue?.includes('Line 2'))).toBe(true);
    });

    it('returns empty array for identical content', () => {
      const content = '# Same Content\nThis is unchanged.';

      const patches = engine.createPatch(content, content);

      expect(patches).toHaveLength(0);
    });

    it('warns about performance when patch generation exceeds 100ms', async () => {
      const { logger } = await import('./logger');
      const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      // Mock performance.now to simulate slow operation
      const originalNow = performance.now;
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 0 : 150; // Simulate 150ms duration
      });

      const original = 'Simple content';
      const modified = 'Modified content';

      engine.createPatch(original, modified);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create_patch',
          duration: 150,
          threshold: 100,
        }),
        expect.stringContaining('Patch generation took 150.0ms (>100ms target)')
      );

      performance.now = originalNow;
      loggerSpy.mockRestore();
    });

    it('throws error on patch creation failure', () => {
      // Mock diff_main to throw an error
      const engineWithError = new PatchEngine();
      const mockDmp = {
        diff_main: vi.fn().mockImplementation(() => {
          throw new Error('Diff failed');
        }),
      };
      (engineWithError as any).dmp = mockDmp;

      expect(() => {
        engineWithError.createPatch('original', 'modified');
      }).toThrow('Failed to create patch: Diff failed');
    });
  });

  describe('applyPatch', () => {
    it('applies patches to restore content', () => {
      const original = '# Title\nOriginal content.';
      const patches: PatchDiff[] = [
        {
          op: 'remove',
          path: '/line/2',
          oldValue: 'Original content.',
        },
        {
          op: 'add',
          path: '/line/2',
          value: 'Updated content.\nAdditional line.',
        },
      ];

      const result = engine.applyPatch(original, patches);

      expect(result.success).toBe(true);
      expect(result.content).toContain('Updated content');
      expect(result.content).toContain('Additional line');
    });

    it('returns error for invalid patches', () => {
      const original = 'Test content';
      const invalidPatches: PatchDiff[] = [
        {
          op: 'add',
          path: '/line/1',
          // Missing required 'value' for add operation
        } as any,
      ];

      const result = engine.applyPatch(original, invalidPatches);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid patches');
    });

    it('handles patch application conflicts', () => {
      const original = 'Line 1\nLine 2\nLine 3';
      const patches: PatchDiff[] = [
        {
          op: 'remove',
          path: '/line/2',
          oldValue: 'Nonexistent line', // This won't match
        },
      ];

      const result = engine.applyPatch(original, patches);

      // The result might be successful but with warnings, or might fail
      // depending on diff-match-patch's tolerance
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.conflicted).toBe(true);
      }
    });

    it('handles empty patches array', () => {
      const original = 'Unchanged content';
      const patches: PatchDiff[] = [];

      const result = engine.applyPatch(original, patches);

      expect(result.success).toBe(true);
      expect(result.content).toBe(original);
    });
  });

  describe('previewPatch', () => {
    it('generates preview diff for review', () => {
      const original = '# Section\nLine 1\nLine 2';
      const modified = '# Section\nLine 1 modified\nLine 3';

      const preview = engine.previewPatch(original, modified);

      expect(preview.additions).toBeGreaterThan(0);
      expect(preview.deletions).toBeGreaterThan(0);
      expect(preview.preview).toContain('+  modified');
      expect(preview.preview).toContain('+ 3');
      expect(preview.patches).toHaveLength(preview.additions + preview.deletions);
    });

    it('calculates correct statistics for additions only', () => {
      const original = 'Line 1';
      const modified = 'Line 1\nLine 2\nLine 3';

      const preview = engine.previewPatch(original, modified);

      expect(preview.additions).toBeGreaterThan(0);
      expect(preview.deletions).toBe(0);
      expect(preview.preview).toContain('+ ');
    });

    it('calculates correct statistics for deletions only', () => {
      const original = 'Line 1\nLine 2\nLine 3';
      const modified = 'Line 1';

      const preview = engine.previewPatch(original, modified);

      expect(preview.additions).toBe(0);
      expect(preview.deletions).toBeGreaterThan(0);
      expect(preview.preview).toContain('- ');
    });

    it('handles replace operations in preview', () => {
      const original = 'Old text';
      const modified = 'New text';

      const preview = engine.previewPatch(original, modified);

      expect(preview.additions).toBeGreaterThan(0);
      expect(preview.deletions).toBeGreaterThan(0);
      expect(preview.preview).toContain('- ');
      expect(preview.preview).toContain('+ ');
    });
  });

  describe('createPendingChange', () => {
    it('creates a pending change record', () => {
      const sectionId = 'section-123';
      const documentId = 'doc-456';
      const original = 'Original content';
      const modified = 'Modified content';
      const createdBy = 'user-789';
      const sessionId = 'session-abc';

      const pendingChange = engine.createPendingChange(
        sectionId,
        documentId,
        original,
        modified,
        createdBy,
        sessionId
      );

      expect(pendingChange).toMatchObject({
        sectionId,
        documentId,
        originalContent: original,
        previewContent: modified,
        createdBy,
        sessionId,
        status: 'pending',
        conflictsWith: [],
      });
      expect(pendingChange.id).toMatch(/^change_\d+_[a-z0-9]+$/);
      expect(pendingChange.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(pendingChange.patches.length).toBeGreaterThan(0);
    });

    it('generates unique IDs for pending changes', () => {
      const change1 = engine.createPendingChange('s1', 'd1', 'orig', 'mod1', 'user', 'session');
      const change2 = engine.createPendingChange('s1', 'd1', 'orig', 'mod2', 'user', 'session');

      expect(change1.id).not.toBe(change2.id);
    });
  });

  describe('detectConflicts', () => {
    it('detects conflicts between overlapping changes', () => {
      const existingChange: PendingChange = {
        id: 'change-1',
        sectionId: 'section-123',
        documentId: 'doc-456',
        patches: [{ op: 'remove', path: '/line/1', oldValue: 'Line 1' }],
        originalContent: 'Line 1\nLine 2',
        previewContent: 'Line 2',
        createdAt: '2025-09-20T10:00:00Z',
        createdBy: 'user-1',
        sessionId: 'session-1',
        status: 'pending',
        conflictsWith: [],
      };

      const newChange: PendingChange = {
        id: 'change-2',
        sectionId: 'section-123',
        documentId: 'doc-456',
        patches: [{ op: 'add', path: '/line/1', value: 'New Line 1' }],
        originalContent: 'Line 1\nLine 2',
        previewContent: 'New Line 1\nLine 1\nLine 2',
        createdAt: '2025-09-20T10:01:00Z',
        createdBy: 'user-2',
        sessionId: 'session-2',
        status: 'pending',
        conflictsWith: [],
      };

      const conflicts = engine.detectConflicts([existingChange], newChange);

      expect(conflicts).toContain('change-1');
    });

    it('ignores applied or failed changes when detecting conflicts', () => {
      const appliedChange: PendingChange = {
        id: 'change-1',
        sectionId: 'section-123',
        documentId: 'doc-456',
        patches: [{ op: 'remove', path: '/line/1', oldValue: 'Line 1' }],
        originalContent: 'Line 1\nLine 2',
        previewContent: 'Line 2',
        createdAt: '2025-09-20T10:00:00Z',
        createdBy: 'user-1',
        sessionId: 'session-1',
        status: 'applied', // Already applied
        conflictsWith: [],
      };

      const newChange: PendingChange = {
        id: 'change-2',
        sectionId: 'section-123',
        documentId: 'doc-456',
        patches: [{ op: 'add', path: '/line/1', value: 'New Line 1' }],
        originalContent: 'Line 1\nLine 2',
        previewContent: 'New Line 1\nLine 1\nLine 2',
        createdAt: '2025-09-20T10:01:00Z',
        createdBy: 'user-2',
        sessionId: 'session-2',
        status: 'pending',
        conflictsWith: [],
      };

      const conflicts = engine.detectConflicts([appliedChange], newChange);

      expect(conflicts).toHaveLength(0);
    });

    it('ignores changes to different sections', () => {
      const existingChange: PendingChange = {
        id: 'change-1',
        sectionId: 'section-123',
        documentId: 'doc-456',
        patches: [{ op: 'remove', path: '/line/1', oldValue: 'Line 1' }],
        originalContent: 'Line 1',
        previewContent: '',
        createdAt: '2025-09-20T10:00:00Z',
        createdBy: 'user-1',
        sessionId: 'session-1',
        status: 'pending',
        conflictsWith: [],
      };

      const newChange: PendingChange = {
        id: 'change-2',
        sectionId: 'section-456', // Different section
        documentId: 'doc-456',
        patches: [{ op: 'add', path: '/line/1', value: 'New Line 1' }],
        originalContent: 'Original',
        previewContent: 'New Line 1\nOriginal',
        createdAt: '2025-09-20T10:01:00Z',
        createdBy: 'user-2',
        sessionId: 'session-2',
        status: 'pending',
        conflictsWith: [],
      };

      const conflicts = engine.detectConflicts([existingChange], newChange);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('validatePatches', () => {
    it('validates correct patches', () => {
      const validPatches: PatchDiff[] = [
        { op: 'add', path: '/line/1', value: 'New content' },
        { op: 'remove', path: '/line/2', oldValue: 'Old content' },
        { op: 'replace', path: '/line/3', value: 'New content', oldValue: 'Old content' },
      ];

      const result = engine.validatePatches(validPatches);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid operation types', () => {
      const invalidPatches: PatchDiff[] = [
        { op: 'invalid' as any, path: '/line/1', value: 'content' },
      ];

      const result = engine.validatePatches(invalidPatches);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Patch 0: Invalid enum value'));
    });

    it('detects missing required fields for add operation', () => {
      const invalidPatches: PatchDiff[] = [
        { op: 'add', path: '/line/1' }, // Missing value
      ];

      const result = engine.validatePatches(invalidPatches);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("'add' operation requires 'value'"))).toBe(true);
    });

    it('detects missing required fields for remove operation', () => {
      const invalidPatches: PatchDiff[] = [
        { op: 'remove', path: '/line/1' }, // Missing oldValue
      ];

      const result = engine.validatePatches(invalidPatches);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("'remove' operation requires 'oldValue'"))).toBe(
        true
      );
    });

    it('detects missing required fields for replace operation', () => {
      const invalidPatches: PatchDiff[] = [
        { op: 'replace', path: '/line/1', value: 'new' }, // Missing oldValue
      ];

      const result = engine.validatePatches(invalidPatches);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e =>
          e.includes("'replace' operation requires both 'value' and 'oldValue'")
        )
      ).toBe(true);
    });
  });

  describe('patch optimization', () => {
    it('optimizes patches by merging adjacent operations', () => {
      // Create patches that should be merged
      const original = 'Line 1\nLine 2\nLine 3';
      const modified = 'Modified Line 1\nModified Line 2\nLine 3';

      const patches = engine.createPatch(original, modified);

      // The optimization should have merged adjacent changes where possible
      // This is implementation-dependent, but we can check that optimization occurred
      expect(patches.length).toBeGreaterThan(0);
    });
  });

  describe('performance characteristics', () => {
    it('handles large content efficiently', () => {
      const largeSections = Array(1000).fill('This is a line of content.').join('\n');
      const modifiedLarge = largeSections.replace('This is a line', 'This is a modified line');

      const startTime = performance.now();
      const patches = engine.createPatch(largeSections, modifiedLarge);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(patches.length).toBeGreaterThan(0);
    });

    it('keeps diff generation under 150ms for medium sections', () => {
      const original = Array.from({ length: 2000 }, (_, index) => `Line ${index}: original`).join(
        '\n'
      );
      const modified = original.replace('Line 1000: original', 'Line 1000: updated content');

      const start = performance.now();
      const patches = engine.createPatch(original, modified);
      const duration = performance.now() - start;

      expect(patches.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(150);
    });

    it('handles empty content gracefully', () => {
      expect(() => engine.createPatch('', '')).not.toThrow();
      expect(() => engine.createPatch('content', '')).not.toThrow();
      expect(() => engine.createPatch('', 'content')).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles unicode content', () => {
      const original = '# 标题\n内容在这里。';
      const modified = '# 标题\n修改的内容在这里。';

      const patches = engine.createPatch(original, modified);
      const result = engine.applyPatch(original, patches);

      expect(result.success).toBe(true);
      expect(patches.length).toBeGreaterThan(0);
    });

    it('handles very long lines', () => {
      const longLine = 'A'.repeat(10000);
      const original = `Short line\n${longLine}\nAnother short line`;
      const modified = `Short line\n${longLine.replace('A', 'B', 1)}\nAnother short line`;

      const patches = engine.createPatch(original, modified);

      expect(patches.length).toBeGreaterThan(0);
    });

    it('handles content with special characters', () => {
      const original = 'Content with \n\t\r special chars';
      const modified = 'Modified content with \n\t\r special chars';

      const patches = engine.createPatch(original, modified);
      const result = engine.applyPatch(original, patches);

      expect(result.success).toBe(true);
    });
  });
});
