import { beforeEach, describe, expect, it, vi } from 'vitest';

const infoMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: {
    info: infoMock,
    warn: warnMock,
  },
  default: {
    info: infoMock,
    warn: warnMock,
  },
}));

const payload = {
  draftKey: 'project/doc/section/user',
  projectSlug: 'project',
  documentSlug: 'doc',
  sectionPath: 'section',
  authorId: 'user',
};

describe('client draft telemetry events', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('emits draft saved events only to the local console', async () => {
    const { emitDraftSaved } = await import('./client-events');

    emitDraftSaved(payload);

    expect(infoMock).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalledWith('[draft.telemetry] draft.saved', {
      message: 'Draft saved locally',
      payload,
    });
  });

  it('emits draft pruned events only to the local console', async () => {
    const { emitDraftPruned } = await import('./client-events');

    emitDraftPruned({ ...payload, prunedKeys: ['older'] });

    expect(warnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] draft.pruned', {
      message: 'Draft pruned due to storage constraints',
      payload: { ...payload, prunedKeys: ['older'] },
    });
  });

  it('emits draft conflict events only to the local console', async () => {
    const { emitDraftConflict } = await import('./client-events');

    emitDraftConflict({ ...payload, reason: 'server-version-newer' });

    expect(warnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] draft.conflict', {
      message: 'Draft entered conflict state',
      payload: { ...payload, reason: 'server-version-newer' },
    });
  });

  it('emits compliance warning events only to the local console', async () => {
    const { emitComplianceWarning } = await import('./client-events');

    emitComplianceWarning({
      ...payload,
      policyId: 'retention-client-only',
      detectedAt: '2025-10-05T12:00:00.000Z',
    });

    expect(warnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] compliance.warning', {
      message: 'Compliance warning captured client-side',
      payload: {
        ...payload,
        policyId: 'retention-client-only',
        detectedAt: '2025-10-05T12:00:00.000Z',
      },
    });
  });
});
