import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Role, User } from '@/features/auth/types';

export interface UsersQuery {
  page: number;
  limit: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface EmployeeInput {
  phone?: string | null;
  employeeNumber?: string | null;
  hireDate?: string | null;
}

export interface CreateUserInput extends EmployeeInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserInput extends EmployeeInput {
  name?: string;
  role?: Role;
  isActive?: boolean;
  canAuthorize?: boolean;
  canDiscountUnlimited?: boolean;
}

const usersKey = ['users'] as const;

export function useUsers(query: UsersQuery) {
  return useQuery({
    queryKey: [...usersKey, query],
    queryFn: async () =>
      (await api.get<Paginated<User>>('/users', { params: query })).data,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: usersKey });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await api.post<User>('/users', input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateUserInput & { id: string }) =>
      (await api.patch<User>(`/users/${id}`, input)).data,
    onSuccess: invalidate,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/users/${id}/password`, { password });
    },
  });
}
