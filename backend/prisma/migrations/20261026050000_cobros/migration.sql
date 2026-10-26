-- CreateEnum
CREATE TYPE "folio_charge_kind" AS ENUM ('CHARGE', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_kind" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "currency" AS ENUM ('MXN', 'USD');

-- AlterTable
ALTER TABLE "hotel_settings" ADD COLUMN     "discount_cap_percent" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "next_receipt_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "receipt_series" TEXT NOT NULL DEFAULT 'A';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "balance_authorized_by_id" UUID,
ADD COLUMN     "balance_due_cents" INTEGER,
ADD COLUMN     "balance_reason" TEXT;

-- AlterTable
ALTER TABLE "stay_charges" ADD COLUMN     "authorized_by_id" UUID,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" UUID,
ADD COLUMN     "waive_reason" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_pin_hash" TEXT,
ADD COLUMN     "can_authorize" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_discount_unlimited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_concepts" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_charges" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "kind" "folio_charge_kind" NOT NULL,
    "concept_id" UUID,
    "stay_charge_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT,
    "authorized_by_id" UUID,
    "created_by_id" UUID NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "kind" "payment_kind" NOT NULL DEFAULT 'PAYMENT',
    "method" "payment_method" NOT NULL,
    "currency" "currency" NOT NULL DEFAULT 'MXN',
    "amount_cents" INTEGER NOT NULL,
    "exchange_rate" DECIMAL(10,4),
    "amount_mxn_cents" INTEGER NOT NULL,
    "reference" TEXT,
    "is_deposit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_hotel_id_date_key" ON "exchange_rates"("hotel_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "charge_concepts_hotel_id_name_key" ON "charge_concepts"("hotel_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "folio_charges_stay_charge_id_key" ON "folio_charges"("stay_charge_id");

-- CreateIndex
CREATE INDEX "folio_charges_reservation_id_idx" ON "folio_charges"("reservation_id");

-- CreateIndex
CREATE INDEX "payments_reservation_id_idx" ON "payments"("reservation_id");

-- CreateIndex
CREATE INDEX "payments_hotel_id_created_at_idx" ON "payments"("hotel_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_hotel_id_receipt_number_key" ON "payments"("hotel_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_balance_authorized_by_id_fkey" FOREIGN KEY ("balance_authorized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_charges" ADD CONSTRAINT "stay_charges_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_charges" ADD CONSTRAINT "stay_charges_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_concepts" ADD CONSTRAINT "charge_concepts_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "charge_concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_stay_charge_id_fkey" FOREIGN KEY ("stay_charge_id") REFERENCES "stay_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_charges" ADD CONSTRAINT "folio_charges_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Los administradores existentes pueden autorizar desde el inicio.
UPDATE "users" SET "can_authorize" = true, "can_discount_unlimited" = true WHERE "role" = 'ADMIN';
