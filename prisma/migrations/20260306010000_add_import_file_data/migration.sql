-- Add file_data column to store uploaded Excel files
ALTER TABLE "import_history" ADD COLUMN "file_data" BYTEA;
