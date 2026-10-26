-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('INE', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER');

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE,
    "nationality" CHAR(2),
    "phone" TEXT,
    "email" TEXT,
    "document_type" "document_type",
    "document_number" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" CHAR(2),
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "notes" TEXT,
    "privacy_accepted_at" TIMESTAMP(3),
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_tax_profiles" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "rfc" VARCHAR(13) NOT NULL,
    "legal_name" TEXT NOT NULL,
    "tax_regime" VARCHAR(3) NOT NULL,
    "zip_code" CHAR(5) NOT NULL,
    "cfdi_use" VARCHAR(4) NOT NULL DEFAULT 'G03',
    "invoice_email" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guests_hotel_id_last_name_idx" ON "guests"("hotel_id", "last_name");

-- CreateIndex
CREATE UNIQUE INDEX "guests_hotel_id_document_type_document_number_key" ON "guests"("hotel_id", "document_type", "document_number");

-- CreateIndex
CREATE INDEX "guest_tax_profiles_hotel_id_rfc_idx" ON "guest_tax_profiles"("hotel_id", "rfc");

-- CreateIndex
CREATE UNIQUE INDEX "guest_tax_profiles_guest_id_rfc_key" ON "guest_tax_profiles"("guest_id", "rfc");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_tax_profiles" ADD CONSTRAINT "guest_tax_profiles_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_tax_profiles" ADD CONSTRAINT "guest_tax_profiles_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

