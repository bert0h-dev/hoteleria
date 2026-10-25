import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HealthStatus {
  status: 'ok';
  database: 'up' | 'down';
  timestamp: string;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<HealthStatus>('/health')).data,
    refetchInterval: 30_000,
  });
}
