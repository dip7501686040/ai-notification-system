-- CreateTable
CREATE TABLE "EventAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfEventId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAiConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAnalysis_tenantId_idx" ON "EventAnalysis"("tenantId");

-- CreateIndex
CREATE INDEX "EventAnalysis_eventId_idx" ON "EventAnalysis"("eventId");

-- CreateIndex
CREATE INDEX "EventAnalysis_tenantId_type_idx" ON "EventAnalysis"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAiConfig_tenantId_key" ON "TenantAiConfig"("tenantId");
