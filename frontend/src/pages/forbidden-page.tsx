import { Link } from 'react-router';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldX className="size-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sin acceso</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Tu rol no tiene permiso para ver esta sección. Si crees que es un
          error, habla con un administrador.
        </p>
      </div>
      <Button variant="outline" render={<Link to="/" />}>
        Volver al inicio
      </Button>
    </div>
  );
}
