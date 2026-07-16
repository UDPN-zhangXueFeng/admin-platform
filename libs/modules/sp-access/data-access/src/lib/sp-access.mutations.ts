import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSpAccess, updateSpAccess } from './sp-access.api';
import { spAccessKeys } from './sp-access.keys';

export function useCreateSpAccessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSpAccess,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: spAccessKeys.lists() });
    },
  });
}

export function useUpdateSpAccessMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSpAccess,
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: spAccessKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: spAccessKeys.detail(variables.spId),
        }),
      ]);
    },
  });
}
