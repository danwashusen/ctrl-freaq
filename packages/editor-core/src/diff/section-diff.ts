import { diff_match_patch, DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from 'diff-match-patch';

const sharedDiffEngine = new diff_match_patch();

export type SectionDiffMode = 'unified' | 'split';
export type SectionDiffSegmentType = 'added' | 'removed' | 'unchanged' | 'context';

export interface SectionDiffRange {
  startLine: number;
  endLine: number;
}

export interface SectionDiffSegment {
  type: SectionDiffSegmentType;
  content: string;
  startLine: number;
  endLine: number;
  metadata?: {
    original?: SectionDiffRange;
    modified?: SectionDiffRange;
    [key: string]: unknown;
  };
}

export interface SectionDiffMetadata {
  approvedVersion?: number;
  draftVersion?: number;
  generatedAt?: string;
  [key: string]: unknown;
}

export interface GenerateSectionDiffOptions {
  mode?: SectionDiffMode;
  approvedVersion?: number;
  draftVersion?: number;
  metadata?: Record<string, unknown>;
}

export interface SectionDiffResult {
  mode: SectionDiffMode;
  segments: SectionDiffSegment[];
  metadata?: SectionDiffMetadata;
}

interface LineIndex {
  readonly lineAt: (position: number) => number;
}

const buildLineIndex = (content: string): LineIndex => {
  const lineNumbers: number[] = new Array(content.length + 1);
  let currentLine = 1;

  for (let index = 0; index <= content.length; index += 1) {
    lineNumbers[index] = currentLine;
    if (content.charAt(index) === '\n') {
      currentLine += 1;
    }
  }

  const lineAt = (position: number): number => {
    const safePosition = Math.max(0, Math.min(position, content.length));
    return lineNumbers[safePosition] ?? currentLine;
  };

  return { lineAt };
};

const mergeSegments = (
  segments: SectionDiffSegment[],
  next: SectionDiffSegment
): SectionDiffSegment[] => {
  const last = segments.length > 0 ? segments[segments.length - 1] : undefined;
  if (!last || last.type !== next.type) {
    return [...segments, next];
  }

  const merged: SectionDiffSegment = {
    type: last.type,
    content: `${last.content}${next.content}`,
    startLine: Math.min(last.startLine, next.startLine),
    endLine: Math.max(last.endLine, next.endLine),
    metadata: {
      ...last.metadata,
      ...next.metadata,
      original: mergeRanges(last.metadata?.original, next.metadata?.original),
      modified: mergeRanges(last.metadata?.modified, next.metadata?.modified),
    },
  };

  const copy = segments.slice(0, -1);
  copy.push(merged);
  return copy;
};

const mergeRanges = (
  first?: SectionDiffRange,
  second?: SectionDiffRange
): SectionDiffRange | undefined => {
  if (!first && !second) return undefined;
  if (!first) return second;
  if (!second) return first;

  return {
    startLine: Math.min(first.startLine, second.startLine),
    endLine: Math.max(first.endLine, second.endLine),
  };
};

const calculateLineRange = (index: LineIndex, start: number, length: number): SectionDiffRange => {
  const endPosition = Math.max(start + length - 1, start);
  return {
    startLine: index.lineAt(start),
    endLine: index.lineAt(endPosition),
  };
};

const createSegment = (
  type: SectionDiffSegmentType,
  content: string,
  startLine: number,
  endLine: number,
  metadata?: SectionDiffSegment['metadata']
): SectionDiffSegment => ({
  type,
  content,
  startLine,
  endLine,
  metadata,
});

export const generateSectionDiff = (
  originalContent: string,
  modifiedContent: string,
  options: GenerateSectionDiffOptions = {}
): SectionDiffResult => {
  const { mode = 'unified', approvedVersion, draftVersion, metadata = {} } = options;

  const originalIndex = buildLineIndex(originalContent);
  const modifiedIndex = buildLineIndex(modifiedContent);

  const diffs = sharedDiffEngine.diff_main(originalContent, modifiedContent);
  sharedDiffEngine.diff_cleanupSemantic(diffs);

  let originalPointer = 0;
  let modifiedPointer = 0;

  let segments: SectionDiffSegment[] = [];

  for (const [operation, text] of diffs) {
    if (!text) {
      continue;
    }

    const length = text.length;

    if (operation === DIFF_EQUAL) {
      const originalRange = calculateLineRange(originalIndex, originalPointer, length);
      const modifiedRange = calculateLineRange(modifiedIndex, modifiedPointer, length);

      const segment = createSegment(
        'unchanged',
        text,
        originalRange.startLine,
        originalRange.endLine,
        {
          original: originalRange,
          modified: modifiedRange,
        }
      );

      segments = mergeSegments(segments, segment);

      originalPointer += length;
      modifiedPointer += length;
      continue;
    }

    if (operation === DIFF_DELETE) {
      const originalRange = calculateLineRange(originalIndex, originalPointer, length);
      const segment = createSegment(
        'removed',
        text,
        originalRange.startLine,
        originalRange.endLine,
        {
          original: originalRange,
          modified: calculateLineRange(modifiedIndex, modifiedPointer, 0),
        }
      );

      segments = mergeSegments(segments, segment);
      originalPointer += length;
      continue;
    }

    if (operation === DIFF_INSERT) {
      const modifiedRange = calculateLineRange(modifiedIndex, modifiedPointer, length);
      const segment = createSegment('added', text, modifiedRange.startLine, modifiedRange.endLine, {
        original: calculateLineRange(originalIndex, originalPointer, 0),
        modified: modifiedRange,
      });

      segments = mergeSegments(segments, segment);
      modifiedPointer += length;
    }
  }

  const resultMetadata: SectionDiffMetadata = { ...metadata };
  if (approvedVersion !== undefined) {
    resultMetadata.approvedVersion = approvedVersion;
  }
  if (draftVersion !== undefined) {
    resultMetadata.draftVersion = draftVersion;
  }
  if (!resultMetadata.generatedAt) {
    resultMetadata.generatedAt = new Date().toISOString();
  }

  return {
    mode,
    segments,
    metadata: Object.keys(resultMetadata).length > 0 ? resultMetadata : undefined,
  };
};
