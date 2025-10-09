#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import { Command } from 'commander';

import {
  createVercelAIProposalProvider,
  runProposalSession,
  type ProposalCompletedEvent,
  type ProposalContext,
  type ProposalProviderEvent,
  type ProposalProvider,
  type ProposalPrompt,
  type ProposalSession,
  type ProposalStreamEvent,
} from './session/proposal-runner.js';

const createProgram = (): Command => {
  const cliProgram = new Command();

  cliProgram
    .name('@ctrl-freaq/ai')
    .description('AI and LLM integration library for CTRL FreaQ using Vercel AI SDK')
    .version('0.1.0');

  cliProgram
    .command('generate')
    .description('Generate content using AI models')
    .option('-m, --model <model>', 'AI model to use', 'gpt-3.5-turbo')
    .option('-p, --prompt <prompt>', 'Prompt for content generation')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              message: 'AI content generation functionality not yet implemented',
              model: options.model,
              prompt: options.prompt,
            },
            null,
            2
          )
        );
      } else {
        console.log('AI Content Generation');
        console.log(`Model: ${options.model}`);
        console.log(`Prompt: ${options.prompt || 'No prompt provided'}`);
        console.log('\nFunctionality not yet implemented.');
      }
    });

  cliProgram
    .command('models')
    .description('List available AI models')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'claude-3-opus'];

      if (options.json) {
        console.log(JSON.stringify({ models }, null, 2));
      } else {
        console.log('Available AI Models:');
        models.forEach(model => console.log(`  - ${model}`));
      }
    });

  cliProgram
    .command('coauthor')
    .description('Replay or execute a co-authoring proposal session from a JSON payload')
    .requiredOption('--payload <path>', 'Path to a JSON payload describing the session')
    .option('--json', 'Output results in JSON format', false)
    .option('--replay', 'Stream using recorded events instead of hitting the live provider', false)
    .option('--model <model>', 'Override the default provider model id')
    .action(async options => {
      try {
        const payloadPath = resolvePath(options.payload);
        const rawPayload = await fs.readFile(payloadPath, 'utf-8');
        const payload = JSON.parse(rawPayload) as CoAuthorPayload;

        assertCoAuthorPayload(payload);

        const replaySnapshot = options.replay ? getReplaySnapshot(payload) : null;
        const provider: ProposalProvider = replaySnapshot
          ? createReplayProvider(replaySnapshot)
          : createVercelAIProposalProvider({ model: options.model });

        const shouldStreamStdout = !options.json && !replaySnapshot;

        const result = await runProposalSession({
          session: payload.session,
          prompt: payload.prompt,
          context: payload.context,
          replay: Boolean(options.replay),
          provider,
          onEvent: shouldStreamStdout
            ? event => {
                if (event.type === 'token') {
                  const value =
                    typeof event.data.value === 'string'
                      ? event.data.value
                      : String(event.data.value ?? '');
                  process.stdout.write(value);
                }
              }
            : undefined,
        });

        if (options.json) {
          console.log(JSON.stringify(result));
        } else {
          if (shouldStreamStdout) {
            process.stdout.write('\n');
          }
          console.log(`Proposal ${result.proposalId}`);
          if (typeof result.confidence === 'number') {
            console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          }
          console.log(`Annotations: ${result.annotations.length}`);
          if (result.rawText && !replaySnapshot) {
            console.log('\nProvider response preview:');
            console.log(result.rawText);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to run co-author session: ${message}`);
        process.exitCode = 1;
      }
    });

  return cliProgram;
};

/**
 * Main CLI function for the AI package
 */
export async function cli(argv?: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void cli(process.argv);
}

interface CoAuthorPayload {
  session: ProposalSession;
  prompt: ProposalPrompt;
  context: ProposalContext;
  events?: ProposalStreamEvent[];
  completion?: ProposalCompletedEvent['data'];
  result?: ProposalCompletedEvent['data'];
  proposal?: ProposalCompletedEvent['data'];
  snapshot?: ProposalCompletedEvent['data'];
  replay?: {
    events?: ProposalStreamEvent[];
    completion?: ProposalCompletedEvent['data'];
    result?: ProposalCompletedEvent['data'];
    proposal?: ProposalCompletedEvent['data'];
    snapshot?: ProposalCompletedEvent['data'];
  };
}

interface ReplaySnapshot {
  events?: ProposalStreamEvent[];
  completion: ProposalCompletedEvent['data'];
}

const assertCoAuthorPayload = (payload: CoAuthorPayload): void => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a JSON object');
  }

  if (!payload.session || !payload.prompt || !payload.context) {
    throw new Error('Payload is missing required session, prompt, or context fields');
  }
};

const createReplayProvider = (snapshot: ReplaySnapshot): ProposalProvider => {
  return {
    async *streamProposal() {
      if (Array.isArray(snapshot.events)) {
        for (const event of snapshot.events) {
          if (!event || typeof event !== 'object') {
            continue;
          }
          if (event.type === 'completed') {
            continue;
          }
          yield event as ProposalProviderEvent;
        }
      }

      return { type: 'completed', data: snapshot.completion } as ProposalCompletedEvent;
    },
  } satisfies ProposalProvider;
};

const extractSnapshotFromRecord = (record: Record<string, unknown>): ReplaySnapshot | null => {
  const completionCandidate =
    (record.completion as ProposalCompletedEvent['data'] | undefined) ??
    (record.result as ProposalCompletedEvent['data'] | undefined) ??
    (record.proposal as ProposalCompletedEvent['data'] | undefined) ??
    (record.snapshot as ProposalCompletedEvent['data'] | undefined);

  if (!completionCandidate) {
    return null;
  }

  const rawEvents = record.events;
  const events = Array.isArray(rawEvents)
    ? (rawEvents as ProposalStreamEvent[]).filter(event => event && event.type !== 'completed')
    : undefined;

  return {
    events,
    completion: completionCandidate,
  };
};

const getReplaySnapshot = (payload: CoAuthorPayload): ReplaySnapshot | null => {
  const direct = extractSnapshotFromRecord(payload as unknown as Record<string, unknown>);
  if (direct) {
    return direct;
  }

  if (payload.replay && typeof payload.replay === 'object') {
    return extractSnapshotFromRecord(payload.replay as unknown as Record<string, unknown>);
  }

  return null;
};
