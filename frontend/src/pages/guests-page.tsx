import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { countryFlag, countryName } from '@/features/guests/countries';
import { GuestBadges } from '@/features/guests/components/guest-badges';
import { GuestDetailsDialog } from '@/features/guests/components/guest-details-dialog';
import { GuestFormDialog } from '@/features/guests/components/guest-form-dialog';
import { useGuests } from '@/features/guests/guests-api';
import { DOCUMENT_TYPES, fullName } from '@/features/guests/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 15;

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'vip', label: 'VIP' },
  { id: 'blocked', label: 'Bloqueados' },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

export function GuestsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const debounced = useDebouncedValue(search.trim());
  const { data, isLoading, isFetching, isError, error } = useGuests({
    page,
    limit: PAGE_SIZE,
    search: debounced || undefined,
    vip: filter === 'vip' || undefined,
    blocked: filter === 'blocked' || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasFilters = !!search || filter !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Huéspedes"
        description="Registro de huéspedes, su contacto y sus datos fiscales."
        actions={
          <Button
            onClick={() => setCreating(true)}
            className="shadow-md shadow-primary/20"
          >
            <Plus />
            Nuevo huésped
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Nombre, teléfono, correo, identificación o RFC…"
              className="pl-9"
              aria-label="Buscar huéspedes"
            />
          </div>
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-all hover:text-foreground',
                  filter === f.id && 'bg-background text-foreground shadow-sm',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'transition-opacity',
            isFetching && !isLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Huésped</TableHead>
                <TableHead className="hidden md:table-cell">Contacto</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Identificación
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  Procedencia
                </TableHead>
                <TableHead className="hidden pr-4 text-right xl:table-cell">
                  Fiscal
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell" />
                  </TableRow>
                ))}

              {data?.data.map((g) => (
                <TableRow
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className={cn(
                    'cursor-pointer',
                    g.isBlocked && 'bg-destructive/[0.03]',
                  )}
                >
                  <TableCell className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={fullName(g)} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {fullName(g)}
                          <GuestBadges guest={g} />
                        </p>
                        <p className="truncate text-sm text-muted-foreground md:hidden">
                          {g.phone ?? g.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    <p>{g.phone ?? '—'}</p>
                    {g.email && (
                      <p className="truncate text-muted-foreground">
                        {g.email}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {g.documentType ? (
                      <>
                        <p className="text-muted-foreground">
                          {DOCUMENT_TYPES[g.documentType]}
                        </p>
                        <p className="font-mono text-xs">{g.documentNumber}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">
                    {g.city || g.country ? (
                      <span>
                        {countryFlag(g.country)}{' '}
                        {g.city ?? countryName(g.country)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden pr-4 text-right xl:table-cell">
                    {g.taxProfileCount ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <FileText className="size-3" />
                        {g.taxProfileCount} RFC
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && (isError || data?.data.length === 0) && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <UsersRound className="size-6" />
              </div>
              {isError ? (
                <p className="text-sm text-destructive">
                  {getErrorMessage(error)}
                </p>
              ) : hasFilters ? (
                <>
                  <p className="font-medium">Sin resultados</p>
                  <p className="text-sm text-muted-foreground">
                    Ningún huésped coincide con la búsqueda.
                  </p>
                  {search && (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus />
                      Registrar «{search.trim()}»
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium">Aún no hay huéspedes</p>
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus />
                    Registrar el primero
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Mostrando{' '}
              <span className="font-medium text-foreground">
                {from}–{to}
              </span>{' '}
              de <span className="font-medium text-foreground">{total}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <GuestDetailsDialog
        guestId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
      <GuestFormDialog
        open={creating}
        onOpenChange={setCreating}
        initialName={/\d|@/.test(search) ? undefined : search}
        onSaved={(g) => setSelectedId(g.id)}
        onUseExisting={(g) => setSelectedId(g.id)}
      />
    </div>
  );
}
