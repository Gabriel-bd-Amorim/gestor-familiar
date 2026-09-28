CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    "receivedAt" DATE NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "requestKey" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Income_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Income_kind_check" CHECK ("kind" IN ('salary', 'other')),
    CONSTRAINT "Income_cents_check" CHECK ("cents" BETWEEN 1 AND 100000000)
);

CREATE UNIQUE INDEX "Income_requestKey_key" ON "Income"("requestKey");
CREATE INDEX "Income_ownerId_receivedAt_idx" ON "Income"("ownerId", "receivedAt");
ALTER TABLE "Income" ADD CONSTRAINT "Income_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
