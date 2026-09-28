CREATE TABLE "Salary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startMonth" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    CONSTRAINT "Salary_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Salary_cents_check" CHECK ("cents" >= 0 AND "cents" <= 100000000)
);

CREATE TABLE "PurchaseSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "firstDue" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseSimulation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseSimulation_values_check" CHECK ("count" BETWEEN 1 AND 360 AND "totalCents" BETWEEN "count" AND 100000000)
);

CREATE UNIQUE INDEX "Salary_userId_startMonth_key" ON "Salary"("userId", "startMonth");
CREATE INDEX "PurchaseSimulation_userId_updatedAt_idx" ON "PurchaseSimulation"("userId", "updatedAt");
ALTER TABLE "Salary" ADD CONSTRAINT "Salary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseSimulation" ADD CONSTRAINT "PurchaseSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
