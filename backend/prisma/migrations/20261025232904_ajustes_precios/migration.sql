-- AlterTable
ALTER TABLE "hotel_settings" ADD COLUMN     "cap_hourly_at_day_rate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "child_max_age" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "lodging_tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 3,
ADD COLUMN     "vat_percent" DOUBLE PRECISION NOT NULL DEFAULT 16;

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "extra_adult_rate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extra_child_rate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "included_adults" INTEGER NOT NULL DEFAULT 2;

-- Los tipos existentes no pueden incluir más adultos que su capacidad.
UPDATE "room_types" SET "included_adults" = LEAST("included_adults", "max_adults");
