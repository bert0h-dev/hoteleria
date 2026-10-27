import { useNavigate } from 'react-router';
import { FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Estado de "no encontrado" para las páginas de impresión (recibo, corte, tarjeta). */
export function DocumentNotFound({ message }: { message: string }) {
  const navigate = useNavigate();

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FileX className="size-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{message}</h1>
          <p className="text-sm text-muted-foreground">
            Puede que se haya eliminado o que el enlace sea incorrecto.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Regresar
        </Button>
      </div>
    </div>
  );
}
