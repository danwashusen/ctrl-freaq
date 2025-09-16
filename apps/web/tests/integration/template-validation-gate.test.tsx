import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { TemplateValidationGate } from '../../src/components/editor/TemplateValidationGate';

describe('TemplateValidationGate', () => {
  const validator = {
    safeParse(value: unknown) {
      const data = value as Record<string, unknown> | null;
      if (!data || typeof data !== 'object' || !('introduction' in data) || !data.introduction) {
        return {
          success: false as const,
          error: {
            issues: [
              {
                path: ['introduction'],
                message: 'Executive Summary is required',
                code: 'custom',
              },
            ],
          },
        };
      }

      return { success: true as const, data };
    },
  };

  test('blocks save when required fields are missing and surfaces inline guidance', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();

    function Harness() {
      const [value, setValue] = useState({
        system_overview: {
          architecture_diagram: 'https://ctrl-freaq.dev/diagram.png',
          tech_stack: 'react',
        },
      });

      return (
        <TemplateValidationGate
          documentId="doc-required-fields"
          templateId="architecture"
          validator={validator}
          value={value}
          onChange={nextValue => setValue(nextValue as typeof value)}
          onValid={onValid}
        >
          {({ submit, setFieldValue, errors }) => (
            <div>
              <button type="button" onClick={() => submit()}>
                Save
              </button>
              <button
                type="button"
                onClick={() => setFieldValue(['introduction'], 'Executive summary provided')}
              >
                Fill Introduction
              </button>
              <ul>
                {errors.map(error => (
                  <li key={error.path.join('.')}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}
        </TemplateValidationGate>
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onValid).not.toHaveBeenCalled();
    expect(screen.getByText(/Executive Summary/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /fill introduction/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onValid).toHaveBeenCalledTimes(1);
  });
});
