-- CreateTable
CREATE TABLE "DailyEventStat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyEventStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyNotificationStat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyNotificationStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyEventStat_tenantId_date_idx" ON "DailyEventStat"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEventStat_tenantId_date_eventType_source_key" ON "DailyEventStat"("tenantId", "date", "eventType", "source");

-- CreateIndex
CREATE INDEX "DailyNotificationStat_tenantId_date_idx" ON "DailyNotificationStat"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyNotificationStat_tenantId_date_channel_key" ON "DailyNotificationStat"("tenantId", "date", "channel");
