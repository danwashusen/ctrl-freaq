import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CreateProjectDialog } from './CreateProjectDialog';

describe('CreateProjectDialog', () => {
  it('allows project names up to 120 characters without validation errors', async () => {
    const handleCreate = vi.fn().mockResolvedValue(undefined);
    const handleCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <CreateProjectDialog
        open
        onCancel={handleCancel}
        onCreate={handleCreate}
        defaultVisibility="workspace"
      />
    );

    const nameInput = screen.getByTestId('create-project-name') as HTMLInputElement;
    const submitButton = screen.getByTestId('create-project-submit');

    const maxLengthName = 'a'.repeat(120);
    await user.clear(nameInput);
    await user.type(nameInput, maxLengthName);

    expect(nameInput.value).toHaveLength(120);
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    await waitFor(() => expect(handleCreate).toHaveBeenCalledTimes(1));
    expect(handleCreate).toHaveBeenCalledWith({
      name: maxLengthName,
      visibility: 'workspace',
    });
  });
});
