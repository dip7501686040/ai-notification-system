-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleMatch" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rule_tenantId_idx" ON "Rule"("tenantId");

-- CreateIndex
CREATE INDEX "Rule_tenantId_eventType_idx" ON "Rule"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "RuleMatch_tenantId_idx" ON "RuleMatch"("tenantId");

-- CreateIndex
CREATE INDEX "RuleMatch_ruleId_idx" ON "RuleMatch"("ruleId");

-- CreateIndex
CREATE INDEX "RuleMatch_eventId_idx" ON "RuleMatch"("eventId");

-- AddForeignKey
ALTER TABLE "RuleMatch" ADD CONSTRAINT "RuleMatch_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
