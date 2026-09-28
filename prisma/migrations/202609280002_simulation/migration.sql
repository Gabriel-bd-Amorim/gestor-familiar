CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "startNumber" INTEGER NOT NULL,
    "firstDue" DATE NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Simulation_count_check" CHECK ("count" BETWEEN 1 AND 360),
    CONSTRAINT "Simulation_startNumber_check" CHECK ("startNumber" BETWEEN 1 AND "count"),
    CONSTRAINT "Simulation_totalCents_check" CHECK ("totalCents" BETWEEN 1 AND 100000000)
);

CREATE INDEX "Simulation_ownerId_createdAt_idx" ON "Simulation"("ownerId", "createdAt");

ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;