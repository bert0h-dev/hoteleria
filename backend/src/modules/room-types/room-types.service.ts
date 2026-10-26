import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type RoomType } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService, changedFields } from '../audit/audit.service.js';
import { HotelService } from '../hotel/hotel.service.js';
import { calculateRates, type PricingSettings } from '../pricing/pricing.js';
import type {
  CreateRoomTypeDto,
  QueryRoomTypesDto,
  UpdateRoomTypeDto,
} from './dto/room-type.dto.js';

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotel: HotelService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthUser, query: QueryRoomTypesDto) {
    const [types, settings] = await Promise.all([
      this.prisma.roomType.findMany({
        where: {
          hotelId: actor.hotelId,
          ...(!query.includeInactive && { isActive: true }),
        },
        include: { _count: { select: { rooms: true } } },
        orderBy: [{ nightlyRate: 'asc' }, { name: 'asc' }],
      }),
      this.hotel.getSettings(actor.hotelId),
    ]);
    return types.map(({ _count, ...type }) => ({
      ...withRates(type, settings),
      roomCount: _count.rooms,
    }));
  }

  async findOne(actor: AuthUser, id: string) {
    const type = await this.findOrThrow(actor, id);
    const settings = await this.hotel.getSettings(actor.hotelId);
    return withRates(type, settings);
  }

  async create(actor: AuthUser, dto: CreateRoomTypeDto) {
    assertIncludedAdults(
      dto.includedAdults ?? Math.min(2, dto.maxAdults),
      dto.maxAdults,
    );
    try {
      const type = await this.prisma.roomType.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name,
          description: dto.description,
          maxAdults: dto.maxAdults,
          maxChildren: dto.maxChildren,
          nightlyRate: dto.nightlyRate,
          includedAdults: dto.includedAdults ?? Math.min(2, dto.maxAdults),
          extraAdultRate: dto.extraAdultRate,
          extraChildRate: dto.extraChildRate,
          amenities: dto.amenities,
        },
      });
      return withRates(type, await this.hotel.getSettings(actor.hotelId));
    } catch (error) {
      throw mapUniqueName(error);
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateRoomTypeDto) {
    const current = await this.findOrThrow(actor, id);
    assertIncludedAdults(
      dto.includedAdults ?? current.includedAdults,
      dto.maxAdults ?? current.maxAdults,
    );
    try {
      const type = await this.prisma.roomType.update({
        where: { id },
        data: dto,
      });
      const changes = changedFields(current, dto);
      if (Object.keys(changes).length) {
        await this.audit.log(actor, {
          action: 'room_type.update',
          entity: 'room_type',
          entityId: id,
          summary: `Modificó el tipo «${type.name}» (${Object.keys(changes).join(', ')})`,
          data: changes as never,
        });
      }
      return withRates(type, await this.hotel.getSettings(actor.hotelId));
    } catch (error) {
      throw mapUniqueName(error);
    }
  }

  async findOrThrow(actor: AuthUser, id: string): Promise<RoomType> {
    const type = await this.prisma.roomType.findFirst({
      where: { id, hotelId: actor.hotelId },
    });
    if (!type) throw new NotFoundException('Tipo de habitación no encontrado');
    return type;
  }
}

/** Agrega las tarifas calculadas (hora, noche, día, semana) al tipo. */
function withRates<T extends RoomType>(type: T, settings: PricingSettings) {
  return { ...type, rates: calculateRates(type.nightlyRate, settings) };
}

function assertIncludedAdults(included: number, maxAdults: number) {
  if (included > maxAdults) {
    throw new BadRequestException(
      'Los adultos incluidos no pueden ser más que la capacidad de adultos',
    );
  }
}

function mapUniqueName(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException(
      'Ya existe un tipo de habitación con ese nombre',
    );
  }
  return error;
}
