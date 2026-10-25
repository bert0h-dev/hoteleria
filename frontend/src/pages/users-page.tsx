import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { RoleBadge } from '@/components/role-badge';
import { UserAvatar } from '@/components/user-avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-context';
import { ROLE_OPTIONS } from '@/features/auth/roles';
import type { Role, User } from '@/features/auth/types';
import { ChangePasswordDialog } from '@/features/users/change-password-dialog';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { useUpdateUser, useUsers } from '@/features/users/users-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

const ROLE_FILTERS = [
  { value: 'all', label: 'Todos los roles' },
  ...ROLE_OPTIONS,
];
const STATUS_FILTERS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
];

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function formatLastLogin(iso: string | null) {
  if (!iso) return 'Nunca';
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeTime.format(days, 'day');
  return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium' });
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [passwordFor, setPasswordFor] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isLoading, isFetching, isError, error } = useUsers({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    role: role === 'all' ? undefined : (role as Role),
    isActive: status === 'all' ? undefined : status === 'active',
  });
  const updateUser = useUpdateUser();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasFilters = !!search || role !== 'all' || status !== 'all';

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (user: User) => {
    setEditing(user);
    setFormOpen(true);
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    const activate = !toggling.isActive;
    try {
      await updateUser.mutateAsync({ id: toggling.id, isActive: activate });
      toast.success(activate ? 'Usuario activado' : 'Usuario desactivado', {
        description: activate
          ? `${toggling.name} ya puede iniciar sesión.`
          : `Se cerraron las sesiones de ${toggling.name}.`,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Administra las cuentas del equipo y sus permisos."
        actions={
          <Button onClick={openCreate} className="shadow-md shadow-primary/20">
            <Plus />
            Nuevo usuario
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden p-0">
        {/* Filtros */}
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre o correo…"
              className="pl-9"
              aria-label="Buscar usuarios"
            />
          </div>
          <FilterSelect
            value={role}
            items={ROLE_FILTERS}
            label="Filtrar por rol"
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
          />
          <FilterSelect
            value={status}
            items={STATUS_FILTERS}
            label="Filtrar por estado"
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>

        {/* Tabla */}
        <div
          className={cn(
            'transition-opacity',
            isFetching && !isLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">
                  Último acceso
                </TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}

              {data?.data.map((user) => {
                const isMe = user.id === me?.id;
                return (
                  <TableRow
                    key={user.id}
                    className={cn(!user.isActive && 'opacity-60')}
                  >
                    <TableCell className="py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.name} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium">
                            {user.name}
                            {isMe && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                Tú
                              </span>
                            )}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            user.isActive
                              ? 'bg-success'
                              : 'bg-muted-foreground/40',
                          )}
                        />
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {formatLastLogin(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Acciones para ${user.name}`}
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setPasswordFor(user)}
                          >
                            <KeyRound />
                            Cambiar contraseña
                          </DropdownMenuItem>
                          {!isMe && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant={
                                  user.isActive ? 'destructive' : 'default'
                                }
                                onClick={() => setToggling(user)}
                              >
                                {user.isActive ? <UserX /> : <UserCheck />}
                                {user.isActive ? 'Desactivar' : 'Activar'}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {!isLoading && (isError || data?.data.length === 0) && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Users className="size-6" />
              </div>
              {isError ? (
                <p className="text-sm text-destructive">
                  {getErrorMessage(error)}
                </p>
              ) : hasFilters ? (
                <>
                  <p className="font-medium">Sin resultados</p>
                  <p className="text-sm text-muted-foreground">
                    Ningún usuario coincide con los filtros.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Aún no hay usuarios</p>
                  <Button size="sm" onClick={openCreate}>
                    <Plus />
                    Crear el primero
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Paginación */}
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
              <span className="hidden text-muted-foreground sm:inline">
                Página {page} de {totalPages}
              </span>
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

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
      />
      <ChangePasswordDialog
        user={passwordFor}
        onOpenChange={() => setPasswordFor(null)}
      />

      <AlertDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.isActive
                ? '¿Desactivar usuario?'
                : '¿Activar usuario?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.isActive
                ? `${toggling?.name} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Puedes reactivarlo cuando quieras.`
                : `${toggling?.name} podrá volver a iniciar sesión.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={toggling?.isActive ? 'destructive' : 'default'}
              onClick={confirmToggle}
            >
              {toggling?.isActive ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  value,
  items,
  label,
  onChange,
}: {
  value: string;
  items: { value: string; label: string }[];
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => v && onChange(v as string)}
    >
      <SelectTrigger className="w-full sm:w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
