-- CreateTable
CREATE TABLE "import_history" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenant_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "imported" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "unmapped_headers" TEXT[],
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_history_tenant_id_idx" ON "import_history"("tenant_id");

-- AddForeignKey
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
