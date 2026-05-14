-- CreateIndex
-- Closes audit S-MED-9: covers reconcile cron query
-- WHERE status = 'PENDING' AND provider = 'MULTICARD' AND createdAt < cutoff
-- ORDER BY createdAt ASC. Prior indexes (pharmacyId, status / invoiceId / orderId)
-- не покрывали leading (status, provider, createdAt) pattern.
CREATE INDEX "Payment_status_provider_createdAt_idx" ON "Payment"("status", "provider", "createdAt");
