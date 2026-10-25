import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useHealth } from '@/features/health/use-health';

export function HomePage() {
  const { data, isLoading, isError } = useHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bienvenido</h1>
        <p className="text-muted-foreground">Sistema de gestión hotelera</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Estado del sistema</CardTitle>
          <CardDescription>
            Conexión con la API y la base de datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatusRow
            label="API"
            ok={!!data}
            text={
              isLoading ? 'Verificando…' : isError ? 'Sin conexión' : 'En línea'
            }
          />
          <StatusRow
            label="Base de datos"
            ok={data?.database === 'up'}
            text={
              !data
                ? '—'
                : data.database === 'up'
                  ? 'Conectada'
                  : 'Sin conexión'
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  text,
}: {
  label: string;
  ok: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <Badge variant={ok ? 'default' : 'destructive'}>{text}</Badge>
    </div>
  );
}
