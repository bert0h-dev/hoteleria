-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'MEDIUM', 'URGENT');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID,
    "area" TEXT,
    "description" TEXT NOT NULL,
    "priority" "ticket_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "blocks_room" BOOLEAN NOT NULL DEFAULT false,
    "reported_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "fixed_by" TEXT,
    "resolution" TEXT,
    "cancel_reason" TEXT,

    CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_tickets_hotel_id_status_idx" ON "maintenance_tickets"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_tickets_hotel_id_created_at_idx" ON "maintenance_tickets"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "maintenance_tickets_room_id_idx" ON "maintenance_tickets"("room_id");

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

