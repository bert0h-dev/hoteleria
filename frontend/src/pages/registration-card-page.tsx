import { useState } from 'react';
import { useParams } from 'react-router';
import { Printer } from 'lucide-react';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { countryName } from '@/features/guests/countries';
import { useGuest } from '@/features/guests/guests-api';
import { DOCUMENT_TYPES } from '@/features/guests/types';
import { useHotel } from '@/features/hotel/hotel-api';
import { useReservation } from '@/features/reservations/reservations-api';
import { MODALITIES, SOURCES, unitLabel } from '@/features/reservations/types';
import {
  formatDate,
  formatDay,
  formatDayTime,
  formatMoney,
  formatMoneyCents,
  setHotelTimeZone,
} from '@/lib/format';

/**
 * Tarjeta de registro para que el huésped la revise y firme al llegar.
 * Página sin menú, pensada para imprimirse en tamaño carta.
 */
export function RegistrationCardPage() {
  const { id } = useParams();
  const { data: reservation } = useReservation(id ?? null);
  const { data: hotel } = useHotel();
  const { data: guest } = useGuest(reservation?.guestId);
  // Momento en que se abrió la tarjeta (no en cada render).
  const [generatedAt] = useState(() => new Date().toISOString());

  if (!reservation || !hotel || !guest) return <FullScreenLoader />;
  // Fechas y horas en la zona del hotel (esta página no usa el layout).
  setHotelTimeZone(hotel.timezone);

  const r = reservation;
  const taxes = r.pricing.taxes;
  const blank = (v?: string | null) => v || ' ';

  return (
    <div className="min-h-svh bg-muted/40 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[8.5in] justify-end gap-2 px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer />
          Imprimir
        </Button>
      </div>

      <article className="mx-auto max-w-[8.5in] space-y-6 bg-white p-10 text-[13px] text-zinc-900 shadow-xl print:p-0 print:shadow-none">
        {/* Encabezado */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-zinc-900 pb-4">
          <div className="flex items-center gap-3">
            <LogoMark className="size-12 shadow-none print:[print-color-adjust:exact]" />
            <div>
              <h1 className="text-xl font-bold">{hotel.name}</h1>
              <p className="text-xs text-zinc-600">
                {[hotel.legalName, hotel.taxId && `RFC ${hotel.taxId}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="text-xs text-zinc-600">
                {[hotel.address, hotel.phone, hotel.email]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-widest text-zinc-500 uppercase">
              Tarjeta de registro
            </p>
            <p className="font-mono text-2xl font-bold">{r.code}</p>
            {r.room && (
              <p className="text-sm">
                Habitación <b className="text-lg">{r.room.number}</b>
              </p>
            )}
          </div>
        </header>

        {/* Huésped */}
        <Section title="Datos del huésped">
          <Grid>
            <Field label="Nombre(s)" value={guest.firstName} />
            <Field label="Apellidos" value={guest.lastName} />
            <Field
              label="Nacionalidad"
              value={blank(countryName(guest.nationality))}
            />
            <Field
              label="Fecha de nacimiento"
              value={blank(guest.birthDate && formatDay(guest.birthDate))}
            />
            <Field
              label="Identificación"
              value={blank(
                guest.documentType &&
                  `${DOCUMENT_TYPES[guest.documentType]} ${guest.documentNumber}`,
              )}
            />
            <Field
              label="Procedencia"
              value={blank(
                [guest.city, guest.state, countryName(guest.country)]
                  .filter(Boolean)
                  .join(', '),
              )}
            />
            <Field label="Teléfono" value={blank(guest.phone)} />
            <Field label="Correo" value={blank(guest.email)} />
          </Grid>
        </Section>

        {/* Estancia */}
        <Section title="Estancia">
          <Grid>
            <Field
              label="Llegada"
              value={formatDayTime(r.checkedInAt ?? r.checkIn)}
            />
            <Field label="Salida" value={formatDayTime(r.checkOut)} />
            <Field
              label="Habitación"
              value={`${r.room ? `#${r.room.number} · ` : ''}${r.roomType.name}`}
            />
            <Field
              label="Modalidad"
              value={`${MODALITIES[r.modality].label} · ${unitLabel(r.modality, r.units)}`}
            />
            <Field
              label="Personas"
              value={`${r.adults} adultos${r.children ? `, ${r.children} niños` : ''}`}
            />
            <Field label="Origen" value={SOURCES[r.source]} />
          </Grid>
          {r.bookedRoomType && (
            <p className="mt-2 text-xs text-zinc-600">
              Reservó «{r.bookedRoomType.name}»; se le asignó «{r.roomType.name}
              » sin costo adicional.
            </p>
          )}
        </Section>

        {/* Tarifa */}
        <Section title="Tarifa">
          <div className="flex items-end justify-between gap-6">
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-xs">
              <dt className="text-zinc-600">Subtotal</dt>
              <dd className="text-right">{formatMoneyCents(taxes.subtotal)}</dd>
              <dt className="text-zinc-600">IVA</dt>
              <dd className="text-right">{formatMoneyCents(taxes.vat)}</dd>
              <dt className="text-zinc-600">ISH</dt>
              <dd className="text-right">
                {formatMoneyCents(taxes.lodgingTax)}
              </dd>
            </dl>
            <div className="text-right">
              <p className="text-xs text-zinc-600">
                Total de la estancia (impuestos incluidos)
              </p>
              <p className="text-2xl font-bold">{formatMoney(r.totalAmount)}</p>
            </div>
          </div>
          {r.taxProfile && (
            <p className="mt-2 text-xs text-zinc-600">
              Facturar a: {r.taxProfile.rfc} · {r.taxProfile.legalName}
            </p>
          )}
        </Section>

        {/* Condiciones */}
        <Section title="Condiciones">
          <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-700">
            <li>
              Horario por noche: entrada a las {hotel.settings.checkInTime} y
              salida a las {hotel.settings.checkOutTime}. Las entradas
              anticipadas y salidas tardías pueden generar un cargo adicional.
            </li>
            <li>
              El hotel no se hace responsable por objetos de valor no
              depositados en la caja fuerte.
            </li>
            <li>
              Los daños a la habitación o al mobiliario se cargarán a la cuenta
              del huésped.
            </li>
            <li>
              {guest.privacyAcceptedAt
                ? `El huésped aceptó el aviso de privacidad el ${formatDate(guest.privacyAcceptedAt)}.`
                : 'Con mi firma acepto el aviso de privacidad del hotel para el tratamiento de mis datos personales.'}
            </li>
          </ul>
        </Section>

        {/* Firmas */}
        <div className="grid grid-cols-2 gap-16 pt-12">
          <Signature
            label={`${guest.firstName} ${guest.lastName}`}
            caption="Firma del huésped"
          />
          <Signature
            label={r.checkedInBy?.name ?? r.createdBy.name}
            caption="Recibió (recepción)"
          />
        </div>

        <footer className="border-t pt-3 text-center text-[11px] text-zinc-500">
          Registro generado el {formatDayTime(generatedAt)} · {hotel.name}
        </footer>
      </article>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</dl>;
}

/** Campo con línea para llenar a mano si viene vacío. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-zinc-300 pb-1">
      <dt className="text-[10px] tracking-wide text-zinc-500 uppercase">
        {label}
      </dt>
      <dd className="min-h-5 font-medium whitespace-pre">{value}</dd>
    </div>
  );
}

function Signature({ label, caption }: { label: string; caption: string }) {
  return (
    <div className="text-center">
      <div className="border-t border-zinc-900 pt-1 font-medium">{label}</div>
      <p className="text-[11px] text-zinc-500">{caption}</p>
    </div>
  );
}
