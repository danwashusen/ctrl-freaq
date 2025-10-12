import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { Logger } from 'pino';

import {
  createSectionStreamQueue,
  type QueueCancellationReason,
  type SectionStreamQueue,
} from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';

interface DocumentQaStreamingTelemetry {
  logReview: (payload: Record<string, unknown>) => void;
}

export interface DocumentQaStreamingDependencies {
  logger: Logger;
  queue?: SectionStreamQueue;
  telemetry: DocumentQaStreamingTelemetry;
  now?: () => Date;
}

interface StartReviewInput {
  sessionId: string;
  documentId: string;
  sectionId: string;
  reviewerId: string;
  prompt: string;
}

interface QueueMetadata {
  disposition: 'started' | 'pending';
  concurrencySlot?: number;
  replacedSessionId: string | null;
  replacementPolicy: 'newest_replaces_pending';
}

class SessionStream {
  private readonly subscribers = new Set<Response>();

  constructor(private readonly sessionId: string) {}

  subscribe(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-DocumentQA-Session', this.sessionId);
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const originalWrite = res.write.bind(res);
    let buffered = '';
    res.write = (chunk: string | Buffer): boolean => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      buffered += text;
      let ok = true;
      while (buffered.includes('\n\n')) {
        const idx = buffered.indexOf('\n\n');
        const message = buffered.slice(0, idx + 2);
        ok = originalWrite(message) && ok;
        buffered = buffered.slice(idx + 2);
      }
      return ok;
    };

    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
    });
  }

  emit(event: string, data: unknown): void {
    const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
    for (const res of this.subscribers) {
      res.write(payload);
    }
  }
}

export class DocumentQaStreamingService {
  private readonly logger: Logger;
  private readonly queue: SectionStreamQueue;
  private readonly telemetry: DocumentQaStreamingTelemetry;
  private readonly getNow: () => Date;
  private readonly streams = new Map<string, SessionStream>();
  private readonly sessionRequests = new Map<string, StartReviewInput>();

  constructor(dependencies: DocumentQaStreamingDependencies) {
    this.logger = dependencies.logger;
    this.queue = dependencies.queue ?? createSectionStreamQueue();
    this.telemetry = dependencies.telemetry;
    this.getNow = dependencies.now ?? (() => new Date());
    this.subscribe = this.subscribe.bind(this);
    this.startReview = this.startReview.bind(this);
    this.cancelReview = this.cancelReview.bind(this);
    this.retryReview = this.retryReview.bind(this);
  }

  private createPromptPreview(prompt: string): string {
    const normalized = prompt.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return 'No prompt provided';
    }
    const limit = 160;
    if (normalized.length <= limit) {
      return normalized;
    }
    return `${normalized.slice(0, limit - 3)}...`;
  }

  private buildTranscriptPlan(request: StartReviewInput): {
    tokens: string[];
    snippets: { analysis: string; verification: string; summary: string };
    summary: { headline: string; followUp: string };
  } {
    const promptPreview = this.createPromptPreview(request.prompt);
    const sectionLabel = request.sectionId.slice(0, 8);
    const tokens: [string, string, string, string] = [
      `Review focus: ${promptPreview}`,
      `Finding: Section ${request.sectionId} needs visible evidence that QA checks cover streaming and fallback telemetry.`,
      `Recommendation: Document ${request.documentId} should capture reviewer ${request.reviewerId} guidance with concrete remediation steps.`,
      'Next steps: Capture QA follow-up tasks and align fallback transcripts with streaming output.',
    ];

    const analysisToken = tokens[0];
    const verificationToken = tokens[1];
    const nextStepsToken = tokens[3];

    return {
      tokens: [...tokens],
      snippets: {
        analysis: analysisToken,
        verification: verificationToken,
        summary: nextStepsToken,
      },
      summary: {
        headline: `QA review completed for section ${sectionLabel}`,
        followUp: nextStepsToken,
      },
    };
  }

  private shouldUseFallbackTransport(): boolean {
    const flag =
      process.env.STREAMING_DISABLED ??
      process.env.DOCUMENT_QA_STREAMING_DISABLED ??
      process.env.AI_STREAMING_DISABLED;
    if (!flag) {
      return false;
    }
    const normalized = String(flag).trim().toLowerCase();
    return (
      normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
    );
  }

  subscribe(sessionId: string, res: Response): void {
    this.getStream(sessionId).subscribe(res);
  }

  async startReview(input: StartReviewInput): Promise<{
    status: 'accepted';
    queue: QueueMetadata;
    sessionId: string;
    streamLocation: string;
  }> {
    const snapshotBefore = this.queue.snapshot();
    const pendingBefore = snapshotBefore.pending.get(input.sectionId)?.sessionId ?? null;
    const activeBefore = snapshotBefore.active.get(input.sectionId)?.sessionId ?? null;

    const enqueuedAt = this.getNow().getTime();
    const queueResult = this.queue.enqueue({
      sessionId: input.sessionId,
      sectionId: input.sectionId,
      enqueuedAt,
    });

    const queueMetadata: QueueMetadata = {
      disposition: queueResult.disposition,
      concurrencySlot:
        queueResult.disposition === 'started' ? queueResult.concurrencySlot : undefined,
      replacedSessionId:
        queueResult.disposition === 'pending'
          ? (queueResult.replacedSessionId ?? pendingBefore ?? activeBefore)
          : null,
      replacementPolicy: 'newest_replaces_pending',
    };

    this.sessionRequests.set(input.sessionId, input);

    this.telemetry.logReview({
      eventId: randomUUID(),
      sessionId: input.sessionId,
      sectionId: input.sectionId,
      status: 'queued',
      concurrencySlot: queueMetadata.concurrencySlot,
    });

    if (queueResult.disposition === 'pending' && queueMetadata.replacedSessionId) {
      if (pendingBefore && queueMetadata.replacedSessionId === pendingBefore) {
        this.sessionRequests.delete(queueMetadata.replacedSessionId);
      }
      this.telemetry.logReview({
        eventId: randomUUID(),
        sessionId: input.sessionId,
        sectionId: input.sectionId,
        status: 'replaced',
        replacedSessionId: queueMetadata.replacedSessionId,
      });
    }

    if (queueResult.disposition === 'started') {
      this.beginReviewRun(input.sessionId);
    }

    return {
      status: 'accepted',
      queue: queueMetadata,
      sessionId: input.sessionId,
      streamLocation: this.buildStreamLocation(input.sessionId),
    };
  }

  async cancelReview(input: {
    sessionId: string;
    sectionId: string;
    reason: QueueCancellationReason;
  }): Promise<{
    status: 'canceled' | 'not_found';
    cancelReason: QueueCancellationReason;
    promotedSessionId: string | null;
  }> {
    const cancelResult = this.queue.cancel(input.sessionId, input.reason);
    if (cancelResult.promoted) {
      this.beginReviewRun(cancelResult.promoted.sessionId);
    }

    if (cancelResult.released) {
      this.telemetry.logReview({
        eventId: randomUUID(),
        sessionId: input.sessionId,
        sectionId: input.sectionId,
        status: 'canceled',
        cancelReason: input.reason,
      });
    }

    return {
      status: cancelResult.released ? 'canceled' : 'not_found',
      cancelReason: input.reason,
      promotedSessionId: cancelResult.promoted?.sessionId ?? null,
    };
  }

  async retryReview(input: { sessionId: string; sectionId: string; intent?: string }): Promise<{
    status: 'requeued';
    previousSessionId: string;
    sessionId: string;
    queue: QueueMetadata;
  }> {
    const original = this.sessionRequests.get(input.sessionId);
    if (!original) {
      throw new Error(`Cannot retry unknown session ${input.sessionId}`);
    }

    const retrySessionId = `${original.sessionId}::retry-${randomUUID()}`;
    const retryRequest: StartReviewInput = {
      ...original,
      sessionId: retrySessionId,
    };

    const result = await this.startReview(retryRequest);

    this.telemetry.logReview({
      eventId: randomUUID(),
      sessionId: retrySessionId,
      sectionId: original.sectionId,
      status: 'retried',
      sourceSessionId: input.sessionId,
    });

    return {
      status: 'requeued',
      previousSessionId: input.sessionId,
      sessionId: retrySessionId,
      queue: result.queue,
    };
  }

  emitProgress(sessionId: string, event: Record<string, unknown>): void {
    const payload = {
      announcementPriority: 'polite',
      timestamp: this.getNow().toISOString(),
      ...event,
    };
    this.getStream(sessionId).emit('progress', payload);
  }

  private completeSession(
    sessionId: string,
    outcome: {
      status: 'completed' | 'fallback_completed';
      delivery: 'streaming' | 'fallback';
      extras?: Record<string, unknown>;
    }
  ): void {
    const request = this.sessionRequests.get(sessionId);
    const completion = this.queue.complete(sessionId);

    if (request) {
      this.telemetry.logReview({
        eventId: randomUUID(),
        sessionId,
        sectionId: request.sectionId,
        status: outcome.status,
        delivery: outcome.delivery,
        ...(outcome.extras ?? {}),
      });
    }

    this.sessionRequests.delete(sessionId);

    if (completion?.activated) {
      const promotedRequest = this.sessionRequests.get(completion.activated.sessionId);

      this.telemetry.logReview({
        eventId: randomUUID(),
        sessionId: completion.activated.sessionId,
        sectionId: completion.activated.sectionId,
        status: 'promoted',
        concurrencySlot: completion.activated.concurrencySlot,
        promotedFromSessionId: sessionId,
        documentId: promotedRequest?.documentId,
      });

      this.beginReviewRun(completion.activated.sessionId);
    }
  }

  private beginReviewRun(sessionId: string): void {
    const request = this.sessionRequests.get(sessionId);
    if (!request) {
      this.logger.warn({ sessionId }, 'Document QA review started without request context');
      return;
    }

    if (this.shouldUseFallbackTransport()) {
      this.beginFallbackReview(request);
      return;
    }

    const transcript = this.buildTranscriptPlan(request);
    const stream = this.getStream(sessionId);

    const analysisProgress = {
      sequence: 1,
      status: 'streaming',
      stage: 'analysis',
      elapsedMs: 120,
      contentSnippet: transcript.snippets.analysis,
      delivery: 'streaming' as const,
      announcementPriority: 'polite' as const,
    };
    const verificationProgress = {
      sequence: 2,
      status: 'streaming',
      stage: 'verification',
      elapsedMs: 240,
      contentSnippet: transcript.snippets.verification,
      delivery: 'streaming' as const,
      announcementPriority: 'polite' as const,
    };
    const summaryProgress = {
      sequence: 3,
      status: 'awaiting-approval',
      stage: 'summary',
      elapsedMs: 360,
      contentSnippet: transcript.snippets.summary,
      delivery: 'streaming' as const,
      announcementPriority: 'assertive' as const,
    };

    let tokenSequence = 1;

    this.emitProgress(sessionId, analysisProgress);
    stream.emit('token', { sequence: tokenSequence++, value: transcript.tokens[0] });

    this.emitProgress(sessionId, verificationProgress);
    stream.emit('token', { sequence: tokenSequence++, value: transcript.tokens[1] });
    stream.emit('token', { sequence: tokenSequence++, value: transcript.tokens[2] });

    this.emitProgress(sessionId, summaryProgress);
    stream.emit('token', { sequence: tokenSequence++, value: transcript.tokens[3] });

    this.completeSession(sessionId, {
      status: 'completed',
      delivery: 'streaming',
      extras: {
        transcriptTokenCount: transcript.tokens.length,
        summary: transcript.summary,
      },
    });
  }

  handleQueuePromotion(promotion: {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  }): void {
    const request = this.sessionRequests.get(promotion.sessionId);

    if (request) {
      this.telemetry.logReview({
        eventId: randomUUID(),
        sessionId: promotion.sessionId,
        sectionId: promotion.sectionId,
        status: 'promoted',
        concurrencySlot: promotion.concurrencySlot,
        documentId: request.documentId,
      });
    }

    this.beginReviewRun(promotion.sessionId);
  }

  private beginFallbackReview(request: StartReviewInput): void {
    const stream = this.getStream(request.sessionId);
    const startedAt = this.getNow().getTime();
    const transcript = this.buildTranscriptPlan(request);

    const emitState = (status: string, extra: Record<string, unknown> = {}) => {
      stream.emit('state', {
        status,
        fallbackReason: 'transport_blocked',
        preservedTokensCount: extra.preservedTokensCount ?? transcript.tokens.length,
        retryAttempted: false,
        elapsedMs: extra.elapsedMs ?? 0,
        timestamp: this.getNow().toISOString(),
        delivery: 'fallback',
      });
    };

    const emitProgress = (payload: Record<string, unknown>) => {
      stream.emit('progress', {
        announcementPriority: 'polite',
        retryAttempted: false,
        fallbackReason: 'transport_blocked',
        preservedTokensCount: transcript.tokens.length,
        delivery: 'fallback',
        timestamp: this.getNow().toISOString(),
        ...payload,
      });
    };

    emitState('fallback_active', { preservedTokensCount: transcript.tokens.length, elapsedMs: 0 });

    emitProgress({
      status: 'fallback',
      stage: 'analysis',
      elapsedMs: 0,
      sequence: 1,
      contentSnippet: transcript.snippets.analysis,
    });
    stream.emit('token', { sequence: 1, value: transcript.tokens[0] });

    emitProgress({
      status: 'fallback',
      stage: 'verification',
      elapsedMs: 180,
      sequence: 2,
      contentSnippet: transcript.snippets.verification,
    });
    stream.emit('token', { sequence: 2, value: transcript.tokens[1] });
    stream.emit('token', { sequence: 3, value: transcript.tokens[2] });

    const completedElapsed = Math.max(360, this.getNow().getTime() - startedAt);

    emitProgress({
      status: 'awaiting-approval',
      stage: 'summary',
      elapsedMs: completedElapsed,
      sequence: 3,
      contentSnippet: transcript.snippets.summary,
      announcementPriority: 'assertive',
    });
    stream.emit('token', { sequence: 4, value: transcript.tokens[3] });

    emitState('fallback_completed', {
      preservedTokensCount: transcript.tokens.length,
      elapsedMs: completedElapsed,
    });

    this.telemetry.logReview({
      eventId: randomUUID(),
      sessionId: request.sessionId,
      sectionId: request.sectionId,
      status: 'fallback',
      fallbackReason: 'transport_blocked',
      preservedTokensCount: transcript.tokens.length,
      retryAttempted: false,
    });

    this.completeSession(request.sessionId, {
      status: 'fallback_completed',
      delivery: 'fallback',
      extras: {
        fallbackReason: 'transport_blocked',
        preservedTokensCount: transcript.tokens.length,
        elapsedMs: completedElapsed,
        transcriptTokenCount: transcript.tokens.length,
        summary: transcript.summary,
      },
    });
  }

  private getStream(sessionId: string): SessionStream {
    let stream = this.streams.get(sessionId);
    if (!stream) {
      stream = new SessionStream(sessionId);
      this.streams.set(sessionId, stream);
    }
    return stream;
  }

  private buildStreamLocation(sessionId: string): string {
    return `/api/v1/document-qa/sessions/${sessionId}/events`;
  }
}
