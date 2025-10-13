import {
  createSectionStreamQueue,
  type CancelResult,
  type CompleteResult,
  type EnqueueResult,
  type QueueCancellationReason,
  type SectionStreamQueue,
  type SectionStreamQueueRequest,
  type SectionStreamQueueSnapshot,
} from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';

type QueueOwner = 'coAuthor' | 'documentQa' | 'assumptions';

interface QueueHandlers {
  onPromoted?: (promotion: {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  }) => void;
  onCanceled?: (details: {
    sessionId: string;
    sectionId: string;
    reason: QueueCancellationReason;
    state: 'active' | 'pending';
  }) => void;
}

interface SessionOwnerMetadata {
  owner: QueueOwner;
  sectionId: string;
}

export class SharedSectionStreamQueueCoordinator {
  private readonly queue = createSectionStreamQueue({
    onCancel: details => this.handleCancel(details.sessionId, details),
  });

  private readonly sessionOwners = new Map<string, SessionOwnerMetadata>();
  private readonly handlers = new Map<QueueOwner, QueueHandlers>();

  registerOwner(owner: QueueOwner, handlers: QueueHandlers = {}): SectionStreamQueue {
    this.handlers.set(owner, handlers);

    const enqueue = (request: SectionStreamQueueRequest): EnqueueResult => {
      const result = this.queue.enqueue(request);
      this.sessionOwners.set(request.sessionId, { owner, sectionId: request.sectionId });
      return result;
    };

    const complete = (sessionId: string): CompleteResult | null => {
      const result = this.queue.complete(sessionId);
      if (!result) {
        return null;
      }

      this.sessionOwners.delete(sessionId);
      const activated = this.filterPromotion(owner, result.activated);

      return {
        releasedSessionId: result.releasedSessionId,
        activated,
      };
    };

    const cancel = (sessionId: string, reason: QueueCancellationReason): CancelResult => {
      const result = this.queue.cancel(sessionId, reason);
      this.sessionOwners.delete(sessionId);
      const promoted = this.filterPromotion(owner, result.promoted);
      return {
        released: result.released,
        reason: result.reason,
        promoted,
      };
    };

    const snapshot = (): SectionStreamQueueSnapshot => {
      return this.queue.snapshot();
    };

    return {
      enqueue,
      complete,
      cancel,
      snapshot,
    };
  }

  private handleCancel(
    sessionId: string,
    details: {
      sessionId: string;
      sectionId: string;
      reason: QueueCancellationReason;
      state: 'active' | 'pending';
    }
  ): void {
    const metadata = this.sessionOwners.get(sessionId);
    if (!metadata) {
      return;
    }

    this.sessionOwners.delete(sessionId);

    const handler = this.handlers.get(metadata.owner);
    handler?.onCanceled?.({
      sessionId: details.sessionId,
      sectionId: metadata.sectionId,
      reason: details.reason,
      state: details.state,
    });
  }

  private filterPromotion(
    caller: QueueOwner,
    promotion: {
      sessionId: string;
      sectionId: string;
      concurrencySlot: number;
    } | null
  ): {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  } | null {
    if (!promotion) {
      return null;
    }

    const metadata = this.sessionOwners.get(promotion.sessionId);
    if (!metadata) {
      return null;
    }

    if (metadata.owner === caller) {
      return promotion;
    }

    const handler = this.handlers.get(metadata.owner);
    handler?.onPromoted?.(promotion);
    return null;
  }
}
