-- AlterTable
ALTER TABLE "hotel_settings" ADD COLUMN     "weekday_adjust_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "weekday_adjust_percent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rate_periods" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "adjustment_percent" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT 'violet',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_periods_hotel_id_start_date_end_date_idx" ON "rate_periods"("hotel_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "rate_periods" ADD CONSTRAINT "rate_periods_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

