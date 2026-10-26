import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Guest,
  type GuestTaxProfile,
} from '../../generated/prisma/client.js';
import { fromDbDate, toDbDate } from '../../common/time/hotel-date.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Paginated } from '../../common/types/paginated.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { validateTaxProfile } from '../catalogs/sat.js';
import type {
  CreateGuestDto,
  DuplicatesQueryDto,
  QueryGuestsDto,
  UpdateGuestDto,
} from './dto/guest.dto.js';
import type {
  CreateTaxProfileDto,
  UpdateTaxProfileDto,
} from './dto/tax-profile.dto.js';
import { buildSearchText, phoneDigits, searchTerms } from './guest-search.js';

type GuestWithProfiles = Guest & { taxProfiles: GuestTaxProfile[] };

export type DuplicateReason = 'phone' | 'email' | 'document';

/** Registro de huéspedes, siempre limitado al hotel del usuario. */
@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: QueryGuestsDto) {
    const terms = query.search ? searchTerms(query.search) : [];
    const where: Prisma.GuestWhereInput = {
      hotelId: actor.hotelId,
      isVip: query.vip,
      isBlocked: query.blocked,
      AND: terms.map((term) => ({ searchText: { contains: term } })),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.guest.findMany({
        where,
        include: { _count: { select: { taxProfiles: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.guest.count({ where }),
    ]);

    const data = rows.map(({ _count, ...guest }) => ({
      ...present(guest),
      taxProfileCount: _count.taxProfiles,
    }));
    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
    } satisfies Paginated<unknown>;
  }

  async findOne(actor: AuthUser, id: string) {
    return presentFull(await this.findRow(actor, id));
  }

  async create(actor: AuthUser, dto: CreateGuestDto) {
    assertContact(dto.phone, dto.email);
    assertDocumentPair(dto.documentType, dto.documentNumber);
    try {
      const guest = await this.prisma.guest.create({
        data: {
          hotelId: actor.hotelId,
          ...guestData(dto),
          firstName: dto.firstName,
          lastName: dto.lastName,
          privacyAcceptedAt: dto.privacyAccepted ? new Date() : null,
          searchText: buildSearchText(dto),
        },
        include: { taxProfiles: true },
      });
      return presentFull(guest);
    } catch (error) {
      throw mapUniqueDocument(error);
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateGuestDto) {
    const current = await this.findRow(actor, id);
    const merged = { ...current, ...definedOnly(dto) };
    assertContact(merged.phone, merged.email);
    assertDocumentPair(merged.documentType, merged.documentNumber);

    const privacyAcceptedAt =
      dto.privacyAccepted === undefined
        ? undefined
        : dto.privacyAccepted
          ? (current.privacyAcceptedAt ?? new Date())
          : null;

    try {
      const guest = await this.prisma.guest.update({
        where: { id },
        data: {
          ...guestData(dto),
          privacyAcceptedAt,
          searchText: buildSearchText({
            ...merged,
            rfcs: current.taxProfiles.map((p) => p.rfc),
          }),
        },
        include: { taxProfiles: true },
      });
      return presentFull(guest);
    } catch (error) {
      throw mapUniqueDocument(error);
    }
  }

  /** Bloquear o desbloquear (solo ADMIN). */
  async setBlocked(
    actor: AuthUser,
    id: string,
    isBlocked: boolean,
    reason?: string,
  ) {
    await this.findRow(actor, id);
    const guest = await this.prisma.guest.update({
      where: { id },
      data: { isBlocked, blockedReason: isBlocked ? reason : null },
      include: { taxProfiles: true },
    });
    return presentFull(guest);
  }

  /**
   * Huéspedes que comparten teléfono, correo o identificación: sirve para
   * avisar de posibles duplicados antes de crear uno nuevo.
   */
  async duplicates(actor: AuthUser, query: DuplicatesQueryDto) {
    const digits = query.phone ? phoneDigits(query.phone) : '';
    const email = query.email?.trim().toLowerCase();
    const documentNumber = query.documentNumber
      ?.trim()
      .toUpperCase()
      .replace(/\s+/g, '');

    const or: Prisma.GuestWhereInput[] = [];
    if (digits.length >= 7) or.push({ searchText: { contains: digits } });
    if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
    if (query.documentType && documentNumber) {
      or.push({ documentType: query.documentType, documentNumber });
    }
    if (or.length === 0) return [];

    const rows = await this.prisma.guest.findMany({
      where: {
        hotelId: actor.hotelId,
        OR: or,
        ...(query.excludeId && { id: { not: query.excludeId } }),
      },
      take: 5,
    });

    return rows.map((guest) => {
      const reasons: DuplicateReason[] = [];
      if (
        digits.length >= 7 &&
        guest.phone &&
        phoneDigits(guest.phone) === digits
      ) {
        reasons.push('phone');
      }
      if (email && guest.email?.toLowerCase() === email) reasons.push('email');
      if (
        documentNumber &&
        guest.documentType === query.documentType &&
        guest.documentNumber === documentNumber
      ) {
        reasons.push('document');
      }
      return { ...present(guest), reasons };
    });
  }

  // --- Datos fiscales ---

  async addTaxProfile(
    actor: AuthUser,
    guestId: string,
    dto: CreateTaxProfileDto,
  ) {
    const guest = await this.findRow(actor, guestId);
    const cfdiUse = dto.cfdiUse ?? 'G03';
    assertTaxProfile({ rfc: dto.rfc, taxRegime: dto.taxRegime, cfdiUse });
    // El primer perfil siempre es el predeterminado.
    const isDefault = dto.isDefault ?? guest.taxProfiles.length === 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (isDefault) await unsetDefault(tx, guestId);
        await tx.guestTaxProfile.create({
          data: {
            hotelId: actor.hotelId,
            guestId,
            rfc: dto.rfc,
            legalName: dto.legalName,
            taxRegime: dto.taxRegime,
            zipCode: dto.zipCode,
            cfdiUse,
            invoiceEmail: dto.invoiceEmail,
            isDefault,
          },
        });
      });
    } catch (error) {
      throw mapUniqueRfc(error);
    }
    return this.refreshSearch(actor, guestId);
  }

  async updateTaxProfile(
    actor: AuthUser,
    guestId: string,
    profileId: string,
    dto: UpdateTaxProfileDto,
  ) {
    const profile = await this.findProfile(actor, guestId, profileId);
    assertTaxProfile({
      rfc: dto.rfc ?? profile.rfc,
      taxRegime: dto.taxRegime ?? profile.taxRegime,
      cfdiUse: dto.cfdiUse ?? profile.cfdiUse,
    });
    if (dto.isDefault === false && profile.isDefault) {
      throw new BadRequestException(
        'Marca otro perfil como predeterminado en lugar de quitarle la marca a este',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) await unsetDefault(tx, guestId);
        await tx.guestTaxProfile.update({
          where: { id: profileId },
          data: {
            rfc: dto.rfc,
            legalName: dto.legalName,
            taxRegime: dto.taxRegime,
            zipCode: dto.zipCode,
            cfdiUse: dto.cfdiUse,
            invoiceEmail: dto.invoiceEmail,
            isDefault: dto.isDefault,
          },
        });
      });
    } catch (error) {
      throw mapUniqueRfc(error);
    }
    return this.refreshSearch(actor, guestId);
  }

  async removeTaxProfile(actor: AuthUser, guestId: string, profileId: string) {
    const profile = await this.findProfile(actor, guestId, profileId);
    await this.prisma.$transaction(async (tx) => {
      await tx.guestTaxProfile.delete({ where: { id: profileId } });
      // Si se borró el predeterminado, otro toma su lugar.
      if (profile.isDefault) {
        const next = await tx.guestTaxProfile.findFirst({
          where: { guestId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) {
          await tx.guestTaxProfile.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
    return this.refreshSearch(actor, guestId);
  }

  // --- Auxiliares ---

  private async findRow(
    actor: AuthUser,
    id: string,
  ): Promise<GuestWithProfiles> {
    const guest = await this.prisma.guest.findFirst({
      where: { id, hotelId: actor.hotelId },
      include: {
        taxProfiles: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
      },
    });
    if (!guest) throw new NotFoundException('Huésped no encontrado');
    return guest;
  }

  private async findProfile(
    actor: AuthUser,
    guestId: string,
    profileId: string,
  ) {
    const guest = await this.findRow(actor, guestId);
    const profile = guest.taxProfiles.find((p) => p.id === profileId);
    if (!profile) throw new NotFoundException('Datos fiscales no encontrados');
    return profile;
  }

  /** Recalcula el texto de búsqueda (incluye los RFC) y devuelve la ficha. */
  private async refreshSearch(actor: AuthUser, guestId: string) {
    const guest = await this.findRow(actor, guestId);
    const searchText = buildSearchText({
      ...guest,
      rfcs: guest.taxProfiles.map((p) => p.rfc),
    });
    await this.prisma.guest.update({
      where: { id: guestId },
      data: { searchText },
    });
    return presentFull(guest);
  }
}

// ---------------------------------------------------------------------------

/** Campos editables del huésped (sin los que se calculan). */
function guestData(dto: UpdateGuestDto) {
  return {
    firstName: dto.firstName,
    lastName: dto.lastName,
    birthDate:
      dto.birthDate === undefined
        ? undefined
        : dto.birthDate
          ? toDbDate(dto.birthDate)
          : null,
    nationality: dto.nationality,
    phone: dto.phone,
    email: dto.email,
    documentType: dto.documentType,
    documentNumber: dto.documentNumber,
    city: dto.city,
    state: dto.state,
    country: dto.country,
    isVip: dto.isVip,
    notes: dto.notes,
  };
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function assertContact(phone?: string | null, email?: string | null) {
  if (!phone && !email) {
    throw new BadRequestException(
      'Indica al menos un dato de contacto: teléfono o correo',
    );
  }
}

function assertDocumentPair(type?: unknown, number?: string | null) {
  if (!!type !== !!number) {
    throw new BadRequestException(
      'Indica el tipo y el número de identificación juntos',
    );
  }
}

function assertTaxProfile(profile: {
  rfc: string;
  taxRegime: string;
  cfdiUse: string;
}) {
  const errors = validateTaxProfile(profile);
  if (errors.length) throw new BadRequestException(errors);
}

function unsetDefault(tx: Prisma.TransactionClient, guestId: string) {
  return tx.guestTaxProfile.updateMany({
    where: { guestId, isDefault: true },
    data: { isDefault: false },
  });
}

/** Respuesta de la API: fecha como YYYY-MM-DD y sin el texto interno. */
function present(guest: Guest) {
  const { searchText: _searchText, ...rest } = guest;
  return {
    ...rest,
    birthDate: guest.birthDate && fromDbDate(guest.birthDate),
  };
}

function presentFull(guest: GuestWithProfiles) {
  return { ...present(guest), taxProfiles: guest.taxProfiles };
}

function mapUniqueDocument(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException('Ya existe un huésped con esa identificación');
  }
  return error;
}

function mapUniqueRfc(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException('Este huésped ya tiene registrado ese RFC');
  }
  return error;
}
