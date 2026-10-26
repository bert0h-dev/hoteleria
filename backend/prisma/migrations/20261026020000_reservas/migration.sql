-- CreateEnum
CREATE TYPE "stay_modality" AS ENUM ('NIGHTLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "reservation_source" AS ENUM ('WALK_IN', 'PHONE', 'WHATSAPP', 'OTHER');

-- AlterTable
ALTER TABLE "hotel_settings" ADD COLUMN     "next_reservation_number" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "guest_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_id" UUID,
    "modality" "stay_modality" NOT NULL,
    "check_in" TIMESTAMPTZ(3) NOT NULL,
    "check_out" TIMESTAMPTZ(3) NOT NULL,
    "units" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "source" "reservation_source" NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'CONFIRMED',
    "requires_deposit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "tax_profile_id" UUID,
    "nightly_rate" INTEGER NOT NULL,
    "base_amount" INTEGER NOT NULL,
    "extras_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "pricing" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" UUID,
    "cancel_reason" TEXT,
    "no_show_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_hotel_id_room_type_id_check_in_check_out_idx" ON "reservations"("hotel_id", "room_type_id", "check_in", "check_out");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_status_idx" ON "reservations"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "reservations_guest_id_idx" ON "reservations"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_hotel_id_code_key" ON "reservations"("hotel_id", "code");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tax_profile_id_fkey" FOREIGN KEY ("tax_profile_id") REFERENCES "guest_tax_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

