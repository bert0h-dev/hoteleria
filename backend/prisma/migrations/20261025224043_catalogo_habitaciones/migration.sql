-- CreateEnum
CREATE TYPE "room_status" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "amenity" AS ENUM ('WIFI', 'AIR_CONDITIONING', 'TV', 'MINIBAR', 'JACUZZI', 'SEA_VIEW', 'BALCONY', 'SAFE', 'COFFEE_MAKER', 'WORKSPACE', 'PARKING', 'PET_FRIENDLY');

-- CreateTable
CREATE TABLE "hotel_settings" (
    "hotel_id" UUID NOT NULL,
    "hourly_rate_percent" INTEGER NOT NULL DEFAULT 15,
    "min_hours" INTEGER NOT NULL DEFAULT 3,
    "day_rate_percent" INTEGER NOT NULL DEFAULT 120,
    "day_duration_hours" INTEGER NOT NULL DEFAULT 24,
    "week_rate_percent" INTEGER NOT NULL DEFAULT 600,
    "check_in_time" VARCHAR(5) NOT NULL DEFAULT '15:00',
    "check_out_time" VARCHAR(5) NOT NULL DEFAULT '12:00',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_settings_pkey" PRIMARY KEY ("hotel_id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_adults" INTEGER NOT NULL,
    "max_children" INTEGER NOT NULL DEFAULT 0,
    "nightly_rate" INTEGER NOT NULL,
    "amenities" "amenity"[] DEFAULT ARRAY[]::"amenity"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "status" "room_status" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_cleaned_at" TIMESTAMP(3),
    "last_cleaned_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_status_logs" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "from_status" "room_status" NOT NULL,
    "to_status" "room_status" NOT NULL,
    "reason" TEXT,
    "changed_by_id" UUID NOT NULL,
    "cleaned_by_id" UUID,
    "cleaned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_types_hotel_id_name_key" ON "room_types"("hotel_id", "name");

-- CreateIndex
CREATE INDEX "rooms_hotel_id_status_idx" ON "rooms"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "rooms_room_type_id_idx" ON "rooms"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_hotel_id_number_key" ON "rooms"("hotel_id", "number");

-- CreateIndex
CREATE INDEX "room_status_logs_room_id_created_at_idx" ON "room_status_logs"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "room_status_logs_hotel_id_cleaned_at_idx" ON "room_status_logs"("hotel_id", "cleaned_at");

-- AddForeignKey
ALTER TABLE "hotel_settings" ADD CONSTRAINT "hotel_settings_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_last_cleaned_by_id_fkey" FOREIGN KEY ("last_cleaned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_cleaned_by_id_fkey" FOREIGN KEY ("cleaned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
