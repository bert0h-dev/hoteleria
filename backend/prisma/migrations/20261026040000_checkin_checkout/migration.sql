-- CreateEnum
CREATE TYPE "stay_charge_kind" AS ENUM ('EARLY_CHECK_IN', 'LATE_CHECK_OUT');

-- CreateEnum
CREATE TYPE "stay_charge_status" AS ENUM ('SUGGESTED', 'CONFIRMED', 'WAIVED');

-- AlterTable
ALTER TABLE "hotel_settings" ADD COLUMN     "grace_minutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "booked_room_type_id" UUID,
ADD COLUMN     "checked_in_at" TIMESTAMP(3),
ADD COLUMN     "checked_in_by_id" UUID,
ADD COLUMN     "checked_out_at" TIMESTAMP(3),
ADD COLUMN     "checked_out_by_id" UUID,
ADD COLUMN     "upgrade_reason" TEXT;

-- CreateTable
CREATE TABLE "stay_charges" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "kind" "stay_charge_kind" NOT NULL,
    "status" "stay_charge_status" NOT NULL DEFAULT 'SUGGESTED',
    "description" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stay_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stay_charges_reservation_id_idx" ON "stay_charges"("reservation_id");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_room_id_status_idx" ON "reservations"("hotel_id", "room_id", "status");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checked_out_by_id_fkey" FOREIGN KEY ("checked_out_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_booked_room_type_id_fkey" FOREIGN KEY ("booked_room_type_id") REFERENCES "room_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_charges" ADD CONSTRAINT "stay_charges_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_charges" ADD CONSTRAINT "stay_charges_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_charges" ADD CONSTRAINT "stay_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

