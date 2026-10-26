-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_number" TEXT,
ADD COLUMN     "hire_date" DATE,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_hotel_id_employee_number_key" ON "users"("hotel_id", "employee_number");

