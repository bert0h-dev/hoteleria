import { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { useAuditLogs } from '@/features/cash/cash-api';
import { AUDIT_ENTITIES } from '@/features/cash/types';
import { formatDayTime } from '@/lib/format';

const PAGE_SIZE = 30;
const ALL = 'all';

/** Bitácora de auditoría (ADMIN). */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState<string>(ALL);
  const { data, isLoading } = useAuditLogs({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    entity: entity === ALL ? undefined : entity,
  });
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora"
        description="Quién hizo qué, cuándo y quién lo autorizó."
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en la descripción…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={entity}
          onValueChange={(v) => {
            setEntity(v ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue>
              {(v: string) =>
                v === ALL ? 'Todos los registros' : AUDIT_ENTITIES[v]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los registros</SelectItem>
            {Object.entries(AUDIT_ENTITIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-0 p-0">
        {isLoading && <Skeleton className="m-4 h-32" />}
        {data?.data.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay eventos.
          </p>
        )}
        {data?.data.map((log) => (
          <div
            key={log.id}
            className="flex gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <UserAvatar name={log.actor.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{log.actor.name}</span>{' '}
                <span className="text-muted-foreground">·</span> {log.summary}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {formatDayTime(log.createdAt)}
                <span>· {AUDIT_ENTITIES[log.entity] ?? log.entity}</span>
                {log.authorizedBy && log.authorizedBy.id !== log.actor.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    <ShieldCheck className="size-3" />
                    Autorizó {log.authorizedBy.name}
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
