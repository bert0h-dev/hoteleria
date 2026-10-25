import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-background p-6">
      <div className="absolute top-1/4 left-1/2 size-96 -translate-x-1/2 rounded-full bg-brand-glow-1/20 blur-3xl" />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-7" />
        </div>
        <p className="bg-linear-to-br from-brand-from to-brand-to bg-clip-text text-7xl font-bold tracking-tight text-transparent">
          404
        </p>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Página no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            La página que buscas no existe o fue movida.
          </p>
        </div>
        <Button render={<Link to="/" />}>Volver al inicio</Button>
      </div>
    </div>
  );
}
