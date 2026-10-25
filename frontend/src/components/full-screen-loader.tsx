import { LogoMark } from './logo';

export function FullScreenLoader() {
  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-12 animate-pulse" />
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    </div>
  );
}
