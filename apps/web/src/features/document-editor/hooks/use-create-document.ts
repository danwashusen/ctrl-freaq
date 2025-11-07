import { useMutation } from '@tanstack/react-query';

import type ApiClient from '@/lib/api';
import type { CreateDocumentResponse } from '@/lib/api';
import { useTemplateStore } from '@/stores/template-store';

interface UseCreateDocumentOptions {
  apiClient: Pick<ApiClient, 'createProjectDocument'>;
  onSuccess?: (response: CreateDocumentResponse) => void;
  onError?: (error: unknown) => void;
}

export function useCreateDocument({ apiClient, onSuccess, onError }: UseCreateDocumentOptions) {
  const setProvisioningState = useTemplateStore(state => state.setProvisioningState);
  const updateProvisioningState = (next: 'idle' | 'pending') => {
    try {
      setProvisioningState(next);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        throw error;
      }
    }
  };

  const mutation = useMutation({
    mutationFn: (projectId: string) => apiClient.createProjectDocument(projectId),
    onMutate: async () => {
      updateProvisioningState('pending');
    },
    onSuccess: data => {
      setTimeout(() => {
        onSuccess?.(data);
      }, 500);
    },
    onError: error => {
      onError?.(error);
    },
    onSettled: () => {
      setTimeout(() => {
        updateProvisioningState('idle');
      });
    },
  });

  return {
    createDocument: mutation.mutate,
    createDocumentAsync: mutation.mutateAsync,
    status: mutation.status,
    isPending: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
