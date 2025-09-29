import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssumptionsChecklist } from '@/features/document-editor/assumptions-flow/components/assumptions-checklist';
import type { AssumptionPromptState } from '@/features/document-editor/types/assumption-session';

describe('AssumptionsChecklist', () => {
  const buildPrompt = (overrides: Partial<AssumptionPromptState> = {}): AssumptionPromptState => ({
    id: overrides.id ?? 'prompt-1',
    heading: overrides.heading ?? 'Confirm deployment baseline',
    body: overrides.body ?? 'Does this section introduce new infrastructure?',
    responseType: overrides.responseType ?? 'text',
    options: overrides.options ?? [],
    priority: overrides.priority ?? 0,
    status: overrides.status ?? 'pending',
    answer: overrides.answer ?? null,
    overrideJustification: overrides.overrideJustification ?? null,
    unresolvedOverrideCount: overrides.unresolvedOverrideCount ?? 0,
    escalation: overrides.escalation,
  });

  it('renders prompts and resolve controls with override banner', () => {
    const prompts = [
      buildPrompt(),
      buildPrompt({
        id: 'prompt-2',
        heading: 'List security controls',
        responseType: 'single_select',
        options: [
          { id: 'yes', label: 'Yes', description: null, defaultSelected: false },
          { id: 'no', label: 'No', description: null, defaultSelected: true },
        ],
      }),
    ];

    const handleRespond = vi.fn();

    render(
      <AssumptionsChecklist
        prompts={prompts}
        overridesOpen={1}
        isLoading={false}
        onRespond={handleRespond}
      />
    );

    expect(screen.getByRole('heading', { name: /Resolve assumptions/i })).toBeVisible();
    expect(screen.getByText(/Resolve overrides before submission/i)).toBeVisible();

    fireEvent.change(screen.getByRole('textbox', { name: /Confirm deployment baseline/i }), {
      target: { value: 'No infrastructure changes' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Mark answered for Confirm deployment baseline/i })
    );

    expect(handleRespond).toHaveBeenCalledWith('prompt-1', 'answer', {
      answer: 'No infrastructure changes',
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: /Skip prompt List security controls/i }));

    expect(handleRespond).toHaveBeenCalledWith('prompt-2', 'skip_override', {
      overrideJustification: 'User chose to override prompt',
    });
  });

  it('shows loading state when prompts are fetching', () => {
    render(<AssumptionsChecklist prompts={[]} overridesOpen={0} isLoading onRespond={vi.fn()} />);

    expect(screen.getByText(/Loading assumption prompts/i)).toBeVisible();
  });
});
