import {
  Armchair,
  Bath,
  Car,
  Coffee,
  Lock,
  Monitor,
  PawPrint,
  Snowflake,
  Tv,
  Waves,
  Wifi,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { Amenity } from './types';

export const AMENITIES: Record<Amenity, { label: string; icon: LucideIcon }> = {
  WIFI: { label: 'Wi-Fi', icon: Wifi },
  AIR_CONDITIONING: { label: 'Aire acondicionado', icon: Snowflake },
  TV: { label: 'Televisión', icon: Tv },
  MINIBAR: { label: 'Frigobar', icon: Wine },
  JACUZZI: { label: 'Jacuzzi', icon: Bath },
  SEA_VIEW: { label: 'Vista al mar', icon: Waves },
  BALCONY: { label: 'Balcón', icon: Armchair },
  SAFE: { label: 'Caja fuerte', icon: Lock },
  COFFEE_MAKER: { label: 'Cafetera', icon: Coffee },
  WORKSPACE: { label: 'Escritorio', icon: Monitor },
  PARKING: { label: 'Estacionamiento', icon: Car },
  PET_FRIENDLY: { label: 'Admite mascotas', icon: PawPrint },
};

export const AMENITY_LIST = Object.keys(AMENITIES) as Amenity[];
