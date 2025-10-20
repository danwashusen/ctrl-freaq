import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createSectionQualityRunner,
  type SectionQualityRunner,
  type SectionQualityRunnerDependencies,
} from './section-quality-runner';
import type { QualityGateStatus } from '../../shared/quality-gate-status.js';

interface RuleFixture {
  ruleId: string;
  title: string;
  severity: QualityGateStatus;
  guidance?: string[];
  docLink?: string | null;
}

const createRule = (overrides: Partial<RuleFixture>): RuleFixture => ({
  ruleId: 'qa.rule.fixture',
  title: 'Fixture rule',
  severity: 'Pass',
  guidance: [],
  docLink: null,
  ...overrides,
});

const buildDependencies = (
  overrides: Partial<SectionQualityRunnerDependencies> = {}
): SectionQualityRunnerDependencies => {
  const timestamps = [1000, 1325];
  const now = vi.fn(() => {
    const tick = timestamps.shift();
    return typeof tick === 'number' ? tick : (timestamps[timestamps.length - 1] ?? 0);
  });

  return {
    evaluateRules: vi.fn(async () => []),
    persistResult: vi.fn(async () => undefined),
    emitTelemetry: vi.fn(),
    generateRunId: () => 'run-fixture-001',
    getRequestId: () => 'req-fixture-001',
    now,
    ...overrides,
  };
};

describe('Section quality runner', () => {
  let dependencies: SectionQualityRunnerDependencies;
  let runner: SectionQualityRunner;

  beforeEach(() => {
    dependencies = buildDependencies();
    runner = createSectionQualityRunner(dependencies);
  });

  it('promotes the highest severity returned by rule evaluation', async () => {
    dependencies.evaluateRules = vi.fn(async () => [
      createRule({ ruleId: 'qa.rule.syntax', severity: 'Pass' }),
      createRule({ ruleId: 'qa.rule.telemetry', severity: 'Warning' }),
      createRule({ ruleId: 'qa.rule.blocker', severity: 'Blocker', guidance: ['Fix heading'] }),
    ]);

    const result = await runner.run({
      sectionId: 'sec-123',
      documentId: 'doc-456',
      triggeredBy: 'user-abc',
      source: 'manual',
    });

    expect(result.status).toBe('Blocker');
    expect(result.rules).toEqual([
      expect.objectContaining({ ruleId: 'qa.rule.syntax', severity: 'Pass' }),
      expect.objectContaining({ ruleId: 'qa.rule.telemetry', severity: 'Warning' }),
      expect.objectContaining({
        ruleId: 'qa.rule.blocker',
        severity: 'Blocker',
        guidance: ['Fix heading'],
      }),
    ]);
    expect(dependencies.persistResult).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: 'sec-123',
        status: 'Blocker',
      })
    );
  });

  it('falls back to Warning severity when warnings exist without blockers', async () => {
    dependencies.evaluateRules = vi.fn(async () => [
      createRule({ ruleId: 'qa.rule.style', severity: 'Warning', guidance: ['Adjust styling'] }),
      createRule({ ruleId: 'qa.rule.links', severity: 'Pass' }),
    ]);

    const result = await runner.run({
      sectionId: 'sec-warning',
      documentId: 'doc-456',
      triggeredBy: 'user-abc',
      source: 'dashboard',
    });

    expect(result.status).toBe('Warning');
  });

  it('returns Pass when no rules escalate beyond pass state', async () => {
    dependencies.evaluateRules = vi.fn(async () => [
      createRule({ ruleId: 'qa.rule.content', severity: 'Pass' }),
      createRule({ ruleId: 'qa.rule.formatting', severity: 'Pass' }),
    ]);

    const result = await runner.run({
      sectionId: 'sec-pass',
      documentId: 'doc-pass',
      triggeredBy: 'user-xyz',
      source: 'auto',
    });

    expect(result.status).toBe('Pass');
  });

  it('captures remediation guidance payload returned by rules', async () => {
    dependencies.evaluateRules = vi.fn(async () => [
      createRule({
        ruleId: 'qa.rule.remediation',
        severity: 'Warning',
        title: 'Resolve telemetry mismatch',
        guidance: ['Add requestId propagation', 'Capture duration metric'],
        docLink: 'https://ctrl-freaq.dev/docs/quality-gates#telemetry',
      }),
    ]);

    const result = await runner.run({
      sectionId: 'sec-remediation',
      documentId: 'doc-telemetry',
      triggeredBy: 'user-remediation',
      source: 'manual',
    });

    expect(result.rules[0]).toMatchObject({
      ruleId: 'qa.rule.remediation',
      title: 'Resolve telemetry mismatch',
      guidance: ['Add requestId propagation', 'Capture duration metric'],
      docLink: 'https://ctrl-freaq.dev/docs/quality-gates#telemetry',
    });
  });

  it('records durationMs using injected clock values', async () => {
    const clock = vi.fn();
    clock.mockReturnValueOnce(10).mockReturnValueOnce(275);
    dependencies.now = clock;
    dependencies.evaluateRules = vi.fn(async () => [createRule({ severity: 'Pass' })]);

    const result = await runner.run({
      sectionId: 'sec-duration',
      documentId: 'doc-duration',
      triggeredBy: 'user-duration',
      source: 'manual',
    });

    expect(result.durationMs).toBe(265);
    expect(dependencies.emitTelemetry).toHaveBeenCalledWith(
      'qualityGate.section.completed',
      expect.objectContaining({
        requestId: 'req-fixture-001',
        durationMs: 265,
      })
    );
  });
});
