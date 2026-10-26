import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from './auth-context';
import type { User } from './types';

export function useUpdateProfile() {
  const { setCurrentUser } = useAuth();
  return useMutation({
    mutationFn: async (input: { name?: string; phone?: string | null }) =>
      (await api.patch<User>('/auth/me', input)).data,
    // Actualiza al instante el nombre en el encabezado y el menú.
    onSuccess: setCurrentUser,
  });
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: async (input: {
      currentPassword: string;
      newPassword: string;
    }) => {
      await api.patch('/auth/me/password', input);
    },
  });
}
