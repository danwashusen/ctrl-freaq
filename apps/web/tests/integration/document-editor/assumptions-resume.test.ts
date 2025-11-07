import { describe, it, expect, vi } from 'vitest';

import { createAssumptionsFlowBootstrap } from '@/features/document-editor/assumptions-flow';

describe('Assumptions Flow Resume Behaviour', () => {
  it('restores active session state after reload with overrides and proposals intact', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/assumptions/session')) {
          expect(url).toContain(
            '/documents/doc-new-content-flow/sections/sec-new-content-flow/assumptions/session'
          );
          return new Response(
            JSON.stringify({
              sessionId: 'session-fixture-001',
              sectionId: 'sec-new-content-flow',
              prompts: [
                {
                  id: 'prompt-fixture-1',
                  heading: 'Confirm security posture',
                  body: 'Does this section introduce new security considerations?',
                  responseType: 'text',
                  options: [],
                  priority: 0,
                  status: 'pending',
                  answer: null,
                  overrideJustification: null,
                  unresolvedOverrideCount: 1,
                },
                {
                  id: 'prompt-fixture-2',
                  heading: 'Validate latency target',
                  body: 'Are latency SLOs aligned with this change?',
                  responseType: 'text',
                  options: [],
                  priority: 1,
                  status: 'answered',
                  answer: 'Latency target remains under 300ms.',
                  overrideJustification: null,
                  unresolvedOverrideCount: 0,
                },
              ],
              overridesOpen: 1,
              summaryMarkdown: 'Fixture assumption summary for test resume.',
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        throw new Error(`Unhandled fetch URL in test: ${url}`);
      });

    const bootstrap = createAssumptionsFlowBootstrap();

    const started = await bootstrap.start({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
    });

    expect(started.sessionId).toBeTruthy();
    expect(started.promptsRemaining).toBeGreaterThan(0);

    const resumed = await bootstrap.resume({ sessionId: started.sessionId });

    expect(resumed.sessionId).toBe(started.sessionId);
    expect(resumed.promptsRemaining).toBeLessThanOrEqual(started.promptsRemaining);
    expect(resumed.proposalHistory.length).toBeGreaterThanOrEqual(1);
    expect(resumed.overridesOpen).toBeGreaterThanOrEqual(0);

    fetchMock.mockRestore();
  });

  it('preserves multi-select answers through respond and resume cycles', async () => {
    const selections = ['ai-service', 'telemetry'];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.endsWith('/assumptions/session')) {
          expect(url).toContain(
            '/documents/doc-new-content-flow/sections/sec-new-content-flow/assumptions/session'
          );
          return new Response(
            JSON.stringify({
              sessionId: 'session-multi-001',
              sectionId: 'sec-new-content-flow',
              prompts: [
                {
                  id: 'prompt-single',
                  heading: 'Confirm security posture',
                  body: 'Does this section introduce new security considerations?',
                  responseType: 'single_select',
                  options: [
                    { id: 'secure', label: 'No impact', description: null, defaultSelected: true },
                    {
                      id: 'risk',
                      label: 'Requires review',
                      description: null,
                      defaultSelected: false,
                    },
                  ],
                  priority: 0,
                  status: 'pending',
                  answer: null,
                  overrideJustification: null,
                  unresolvedOverrideCount: 0,
                },
                {
                  id: 'prompt-multi',
                  heading: 'Select integration updates',
                  body: 'Choose integrations impacted by this change.',
                  responseType: 'multi_select',
                  options: [
                    {
                      id: 'ai-service',
                      label: 'AI Service',
                      description: null,
                      defaultSelected: false,
                    },
                    {
                      id: 'telemetry',
                      label: 'Telemetry',
                      description: null,
                      defaultSelected: false,
                    },
                    {
                      id: 'persistence-layer',
                      label: 'Persistence layer',
                      description: null,
                      defaultSelected: true,
                    },
                  ],
                  priority: 1,
                  status: 'pending',
                  answer: null,
                  overrideJustification: null,
                  unresolvedOverrideCount: 0,
                },
              ],
              overridesOpen: 0,
              summaryMarkdown: null,
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (url.includes('/assumptions/prompt-multi/respond')) {
          expect(url).toContain(
            '/documents/doc-new-content-flow/sections/sec-new-content-flow/assumptions/prompt-multi/respond'
          );
          const requestBody = init?.body ? JSON.parse(String(init.body)) : {};
          return new Response(
            JSON.stringify({
              id: 'prompt-multi',
              heading: 'Select integration updates',
              body: 'Choose integrations impacted by this change.',
              responseType: 'multi_select',
              options: [
                {
                  id: 'ai-service',
                  label: 'AI Service',
                  description: null,
                  defaultSelected: false,
                },
                { id: 'telemetry', label: 'Telemetry', description: null, defaultSelected: false },
                {
                  id: 'persistence-layer',
                  label: 'Persistence layer',
                  description: null,
                  defaultSelected: true,
                },
              ],
              priority: 1,
              status: 'answered',
              answer: requestBody.answer,
              overrideJustification: null,
              unresolvedOverrideCount: 0,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        throw new Error(`Unhandled fetch URL in test: ${url}`);
      });

    const bootstrap = createAssumptionsFlowBootstrap();

    const started = await bootstrap.start({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
    });

    const multiPrompt = started.prompts.find(prompt => prompt.responseType === 'multi_select');
    expect(multiPrompt).toBeDefined();

    const answered = await bootstrap.respond({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      sessionId: started.sessionId,
      promptId: multiPrompt!.id,
      action: 'answer',
      payload: { answer: JSON.stringify(selections) },
      currentState: started,
    });

    const answeredPrompt = answered.prompts.find(prompt => prompt.id === multiPrompt!.id);
    expect(answeredPrompt?.answer).toBe(JSON.stringify(selections));

    const resumed = await bootstrap.resume({ sessionId: started.sessionId });
    const resumedPrompt = resumed.prompts.find(prompt => prompt.id === multiPrompt!.id);

    expect(resumedPrompt?.answer).toBe(JSON.stringify(selections));

    fetchMock.mockRestore();
  });
});
