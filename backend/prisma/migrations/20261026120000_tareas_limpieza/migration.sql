-- CreateEnum
CREATE TYPE "cleaning_kind" AS ENUM ('DEPARTURE', 'STAYOVER');

-- CreateEnum
CREATE TYPE "cleaning_task_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "room_status_logs" ADD COLUMN     "cleaning_task_id" UUID;

-- CreateTable
CREATE TABLE "cleaning_tasks" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "kind" "cleaning_kind" NOT NULL,
    "status" "cleaning_task_status" NOT NULL DEFAULT 'PENDING',
    "is_priority" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "assigned_to_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "finished_by_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,

    CONSTRAINT "cleaning_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cleaning_tasks_hotel_id_status_idx" ON "cleaning_tasks"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "cleaning_tasks_hotel_id_finished_at_idx" ON "cleaning_tasks"("hotel_id", "finished_at");

-- AddForeignKey
ALTER TABLE "room_status_logs" ADD CONSTRAINT "room_status_logs_cleaning_task_id_fkey" FOREIGN KEY ("cleaning_task_id") REFERENCES "cleaning_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_finished_by_id_fkey" FOREIGN KEY ("finished_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Una sola tarea activa por habitación.
CREATE UNIQUE INDEX "cleaning_tasks_one_active_per_room" ON "cleaning_tasks"("room_id") WHERE "status" IN ('PENDING', 'IN_PROGRESS');
