-- PDF Review Notes feature tables
-- Run via: npx prisma db push  (or prisma migrate deploy)

CREATE TABLE IF NOT EXISTS "pdf_documents" (
    "id" SERIAL NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "cloudinary_public_id" TEXT,
    "cloudinary_url" TEXT,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "extraction_type" TEXT DEFAULT 'none',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pdf_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pdf_pages" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "page_number" INTEGER NOT NULL,
    "cloudinary_public_id" TEXT,
    "image_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pdf_pages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pdf_pages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "pdf_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pdf_pages_document_id_page_number_key" ON "pdf_pages"("document_id", "page_number");

CREATE TABLE IF NOT EXISTS "pdf_extracted_notes" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "page_id" INTEGER,
    "page_number" INTEGER NOT NULL,
    "note_type" TEXT NOT NULL,
    "extracted_text" TEXT DEFAULT '',
    "summary" TEXT DEFAULT '',
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "author" TEXT,
    "subject" TEXT,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pdf_extracted_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pdf_extracted_notes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "pdf_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pdf_extracted_notes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pdf_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
