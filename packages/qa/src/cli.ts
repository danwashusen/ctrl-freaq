#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { Command } from 'commander';

import {
  evaluateArchivedProjectCorrections,
  type ArchivedProjectAuditRecord,
} from './audit/archived-projects.js';

const DEFAULT_API_BASE_URL = process.env.QUALITY_GATES_API_URL ?? 'http://localhost:5001/api/v1';
const DEFAULT_API_TOKEN = process.env.QUALITY_GATES_TOKEN ?? null;

type QualityGateSource = 'auto' | 'manual' | 'dashboard';

interface RunSectionInput {
  sectionId: string;
  documentId: string;
  triggeredBy?: string | null;
  source?: QualityGateSource;
}

interface RunDocumentInput {
  documentId: string;
  triggeredBy?: string | null;
  source?: QualityGateSource;
}

interface RunResult {
  requestId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  runId?: string;
  durationMs?: number;
  message?: string;
  incidentId?: string | null;
}

interface QualityGateCliHandlers {
  runSection(input: RunSectionInput): Promise<RunResult>;
  runDocument(input: RunDocumentInput): Promise<RunResult>;
}

interface QualityGateApiConfig {
  apiUrl: string;
  token?: string | null;
  fetchImpl?: typeof fetch;
}

const createQualityGateCliHandlers = (config: QualityGateApiConfig): QualityGateCliHandlers => {
  const fetchImpl = config.fetchImpl ?? fetch;

  const buildHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.token) {
      headers.Authorization = `Bearer ${config.token}`;
    }
    return headers;
  };

  const toUrl = (path: string): string => {
    const base = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl;
    return `${base}${path}`;
  };

  return {
    async runSection(input) {
      const response = await fetchImpl(
        toUrl(`/documents/${input.documentId}/sections/${input.sectionId}/quality-gates/run`),
        {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify({
            reason: input.source,
          }),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        const incidentId =
          typeof payload?.details === 'object'
            ? (payload.details as Record<string, unknown>).incidentId
            : undefined;
        return {
          requestId: (payload.requestId as string) ?? 'unknown',
          status: 'failed',
          message:
            (payload.message as string) ??
            `Quality gate request failed with status ${response.status}`,
          incidentId: incidentId && typeof incidentId === 'string' ? incidentId : null,
        };
      }

      return {
        requestId: (payload.requestId as string) ?? 'unknown',
        status: (payload.status as RunResult['status']) ?? 'queued',
        runId: typeof payload.runId === 'string' ? payload.runId : undefined,
        message: payload.receivedAt ? `Accepted at ${payload.receivedAt}` : undefined,
      };
    },

    async runDocument(input) {
      const response = await fetchImpl(toUrl(`/documents/${input.documentId}/quality-gates/run`), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          reason: input.source,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        return {
          requestId: (payload.requestId as string) ?? 'unknown',
          status: 'failed',
          message:
            (payload.message as string) ??
            `Document quality gate request failed with status ${response.status}`,
        };
      }

      return {
        requestId: (payload.requestId as string) ?? 'unknown',
        status: (payload.status as RunResult['status']) ?? 'queued',
        runId: typeof payload.runId === 'string' ? payload.runId : undefined,
        message: payload.receivedAt ? `Accepted at ${payload.receivedAt}` : undefined,
      };
    },
  };
};

const normalizeSource = (value?: string): QualityGateSource => {
  switch ((value ?? 'manual').toLowerCase()) {
    case 'auto':
      return 'auto';
    case 'dashboard':
      return 'dashboard';
    case 'manual':
    default:
      return 'manual';
  }
};

const program = new Command();

/**
 * Main CLI function for the QA package
 */
export function cli(argv?: string[]): void {
  program
    .name('@ctrl-freaq/qa')
    .description('Quality assurance and validation library for CTRL FreaQ documentation')
    .version('0.1.0');

  program
    .command('validate')
    .description('Validate documentation against quality gates')
    .option('-f, --file <file>', 'File to validate')
    .option('-s, --schema <schema>', 'Schema to validate against')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              message: 'Document validation functionality not yet implemented',
              file: options.file,
              schema: options.schema,
              validationResult: {
                valid: true,
                errors: [],
                warnings: [],
              },
            },
            null,
            2
          )
        );
      } else {
        console.log(`Document Validation`);
        console.log(`File: ${options.file || 'No file specified'}`);
        console.log(`Schema: ${options.schema || 'Default schema'}`);
        console.log('\nValidation functionality not yet implemented.');
      }
    });

  program
    .command('check')
    .description('Run quality checks on documentation')
    .option('-r, --rules <rules>', 'Comma-separated list of rules to check')
    .option('--fix', 'Auto-fix issues where possible', false)
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      const rules = options.rules
        ? options.rules.split(',')
        : ['spelling', 'grammar', 'links', 'formatting'];

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              rules,
              autoFix: options.fix,
              results: {
                passed: 0,
                failed: 0,
                warnings: 0,
              },
            },
            null,
            2
          )
        );
      } else {
        console.log('Quality Checks:');
        console.log(`Rules: ${rules.join(', ')}`);
        console.log(`Auto-fix: ${options.fix ? 'enabled' : 'disabled'}`);
        console.log('\nQuality check functionality not yet implemented.');
      }
    });

  program
    .command('gates')
    .description('List available quality gates')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      const gates = [
        'spell-check',
        'link-validation',
        'structure-validation',
        'accessibility-check',
      ];

      if (options.json) {
        console.log(JSON.stringify({ gates }, null, 2));
      } else {
        console.log('Available Quality Gates:');
        gates.forEach(gate => console.log(`  - ${gate}`));
      }
    });

  program
    .command('run-section')
    .description('Run quality gates for a single section')
    .requiredOption('--section-id <sectionId>', 'Section identifier')
    .requiredOption('--document-id <documentId>', 'Document identifier owning the section')
    .option('--api-url <apiUrl>', 'Quality gates API base URL', DEFAULT_API_BASE_URL)
    .option('--token <token>', 'Bearer token for authentication', DEFAULT_API_TOKEN ?? undefined)
    .option('--triggered-by <userId>', 'Actor initiating the validation')
    .option('--source <source>', 'Validation source (auto, manual, dashboard)', 'manual')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      const handlers = createQualityGateCliHandlers({
        apiUrl: options.apiUrl ?? DEFAULT_API_BASE_URL,
        token: options.token ?? DEFAULT_API_TOKEN,
      });
      const source = normalizeSource(options.source);

      const result = await handlers.runSection({
        sectionId: options.sectionId,
        documentId: options.documentId,
        triggeredBy: options.triggeredBy ?? null,
        source,
      });

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              scope: 'section',
              sectionId: options.sectionId,
              documentId: options.documentId,
              triggeredBy: options.triggeredBy ?? null,
              source,
              runId: result.runId ?? null,
              ...result,
            },
            null,
            2
          )
        );
      } else {
        console.log('Quality Gate Section Run');
        console.log(`  Document: ${options.documentId}`);
        console.log(`  Section:  ${options.sectionId}`);
        console.log(`  Request:  ${result.requestId}`);
        if (result.runId) {
          console.log(`  Run ID:   ${result.runId}`);
        }
        console.log(`  Status:   ${result.status}`);
        console.log(`  Source:   ${source}`);
        if (result.message) {
          console.log(`\n${result.message}`);
        }
        if (result.incidentId) {
          console.log(`\nIncident ID: ${result.incidentId}`);
        }
      }
    });

  program
    .command('run-document')
    .description('Run quality gates across an entire document')
    .requiredOption('--document-id <documentId>', 'Document identifier to validate')
    .option('--triggered-by <userId>', 'Actor initiating the validation')
    .option('--source <source>', 'Validation source (auto, manual, dashboard)', 'manual')
    .option('--api-url <apiUrl>', 'Quality gates API base URL', DEFAULT_API_BASE_URL)
    .option('--token <token>', 'Bearer token for authentication', DEFAULT_API_TOKEN ?? undefined)
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      const handlers = createQualityGateCliHandlers({
        apiUrl: options.apiUrl ?? DEFAULT_API_BASE_URL,
        token: options.token ?? DEFAULT_API_TOKEN,
      });
      const source = normalizeSource(options.source);
      const result = await handlers.runDocument({
        documentId: options.documentId,
        triggeredBy: options.triggeredBy ?? null,
        source,
      });

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              scope: 'document',
              documentId: options.documentId,
              triggeredBy: options.triggeredBy ?? null,
              source,
              ...result,
            },
            null,
            2
          )
        );
      } else {
        console.log('Quality Gate Document Run');
        console.log(`  Document: ${options.documentId}`);
        console.log(`  Request:  ${result.requestId}`);
        console.log(`  Status:   ${result.status}`);
        console.log(`  Source:   ${source}`);
        if (result.message) {
          console.log(`\n${result.message}`);
        }
      }
    });

  const parseThreshold = (value?: string): number | undefined => {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    if (trimmed.endsWith('%')) {
      const numeric = Number.parseFloat(trimmed.slice(0, -1));
      return Number.isFinite(numeric) ? numeric / 100 : undefined;
    }
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    return numeric > 1 ? numeric / 100 : numeric;
  };

  const audit = program
    .command('audit')
    .description('Audit utilities for success criteria tracking');

  audit
    .command('archived-projects')
    .description('Evaluate archived project audit samples against SC-004 threshold')
    .option('-i, --input <file>', 'Path to JSON array of archived project audit records')
    .option('-t, --threshold <value>', 'Correction rate threshold, e.g. 0.05 or 5%')
    .option('--min-sample <value>', 'Minimum required sample size', value =>
      Number.parseInt(value, 10)
    )
    .option('--json', 'Emit JSON output', false)
    .action(options => {
      let records: unknown[] = [];
      if (options.input) {
        try {
          const raw = readFileSync(options.input, 'utf-8');
          const parsed = JSON.parse(raw);
          records = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error('Failed to read archived project audit input', error);
          process.exitCode = 1;
          return;
        }
      }

      const normalizedRecords = records.map(record => {
        const data =
          typeof record === 'object' && record !== null ? (record as Record<string, unknown>) : {};
        return {
          projectId: String(data.projectId ?? data.id ?? 'unknown-project'),
          archivedAt: String(data.archivedAt ?? data.archived_at ?? ''),
          reviewedAt: String(data.reviewedAt ?? data.reviewed_at ?? ''),
          correctionRequired: Boolean(
            data.correctionRequired ?? data.needsCorrection ?? data.requiresCorrection ?? false
          ),
          correctionCategory: data.correctionCategory ? String(data.correctionCategory) : undefined,
          notes: data.notes ? String(data.notes) : undefined,
        } satisfies ArchivedProjectAuditRecord;
      });

      const threshold = parseThreshold(options.threshold);
      const minimumSampleSize =
        typeof options.minSample === 'number' && Number.isFinite(options.minSample)
          ? options.minSample
          : undefined;

      const result = evaluateArchivedProjectCorrections(normalizedRecords, {
        threshold,
        minimumSampleSize,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const ratePercent = (result.correctionRate * 100).toFixed(2);
      const thresholdPercent = (result.threshold * 100).toFixed(2);

      console.log('Archived project audit sampling results');
      console.log(`  Sample size: ${result.sampleSize}`);
      console.log(`  Corrections: ${result.corrections}`);
      console.log(`  Correction rate: ${ratePercent}% (threshold ${thresholdPercent}%)`);
      console.log(`  Status: ${result.withinThreshold ? 'PASS' : 'FAIL'}`);

      if (result.insufficientSample) {
        console.log('  Warning: sample size is below the recommended minimum.');
      }

      if (result.projectsNeedingReview.length > 0) {
        console.log('  Projects requiring correction:');
        for (const projectId of result.projectsNeedingReview) {
          console.log(`    - ${projectId}`);
        }
      }
    });

  program.parse(argv);
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
