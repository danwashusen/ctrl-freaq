import { describe, expect, it, vi } from 'vitest';

import { createSectionQualityService } from '../../../src/modules/quality-gates/services/section-quality.service.js';

const baseDependencies = () => ({
  sectionRunner: {
    run: vi.fn(),
  },
  repository: {
    upsertResult: vi.fn(),
  },
  telemetry: {
    emitSectionRun: vi.fn(),
  },
  auditLogger: {
    logQueued: vi.fn(),
    logCompleted: vi.fn(),
    logFailed: vi.fn(),
  },
});

describe('SectionQualityService timeout handling', () => {
  it('propagates incident identifiers when the runner exceeds its SLA', async () => {
    const dependencies = baseDependencies();
    dependencies.sectionRunner.run.mockRejectedValue(
      Object.assign(new Error('Runner exceeded SLA'), {
        code: 'QUALITY_GATE_TIMEOUT',
        incidentId: 'incident-quality-001',
      })
    );

    const service = createSectionQualityService(dependencies);
    const result = await service.runSection({
      sectionId: 'sec-quality-timeout',
      documentId: 'doc-quality-timeout',
      triggeredBy: 'user-timeout',
      source: 'dashboard',
    });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') {
      throw new Error('Expected runSection to fail');
    }
    expect(result.incidentId).toBe('incident-quality-001');
    expect(dependencies.auditLogger.logFailed).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: 'incident-quality-001' })
    );
    expect(dependencies.repository.upsertResult).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: 'sec-quality-timeout',
        documentId: 'doc-quality-timeout',
        status: 'Blocker',
        incidentId: 'incident-quality-001',
        rules: expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'quality_gates.runner.unavailable',
            severity: 'Blocker',
          }),
        ]),
        lastRunAt: expect.any(Date),
      })
    );
  });
});
