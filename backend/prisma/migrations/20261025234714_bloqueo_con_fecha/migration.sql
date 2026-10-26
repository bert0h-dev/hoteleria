-- AlterTable
ALTER TABLE "room_status_logs" ADD COLUMN     "blocked_until" DATE,
ADD COLUMN     "previous_blocked_until" DATE;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "blocked_until" DATE;
