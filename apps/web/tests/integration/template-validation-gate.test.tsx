/* eslint-disable import/no-unresolved */
// @ts-expect-error Template compiler path available post-build
import { compileTemplateFile } from '../../../packages/templates/src/compilers/template-compiler';
// @ts-expect-error Template validator path available post-build
import { createTemplateValidator } from '../../../packages/templates/src/validators/template-validator';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { TemplateValidationGate } from '../../src/components/editor/TemplateValidationGate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = resolve(
  __dirname,
  '../../../packages/templates/tests/fixtures/architecture.valid.yaml'
);

describe('TemplateValidationGate', () => {
  let validator: ReturnType<typeof createTemplateValidator>;

  beforeAll(async () => {
    const compiled = await compileTemplateFile(fixturePath);
    validator = createTemplateValidator({
      templateId: compiled.catalog.id,
      version: compiled.version.version,
      schemaJson: compiled.version.schemaJson,
    });
  });

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
