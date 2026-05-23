// ============================================================
// SEERA PLATFORM v4 - ISP Tracking Module
// ============================================================
import { Module }         from '@nestjs/common';
import { Cron }           from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { IspTrackingService }    from './isp-tracking.service';
import { IspTrackingController } from './isp-tracking.controller';
import { WeApiClient }           from './we-api.client';
import { SecurityModule }        from '../../security/security.module';

// Separate provider so @Cron works on a real injectable class
@Injectable()
export class IspScheduler {
  private readonly logger = new Logger(IspScheduler.name);
  constructor(private readonly ispService: IspTrackingService) {}

  // Sync ALL active accounts every 6 hours at minute 0
  @Cron('0 */6 * * *', { name: 'isp_quota_auto_sync' })
  async handleScheduledSync() {
    this.logger.log('⏰ Scheduled ISP quota sync starting...');
    try {
      const result = await this.ispService.syncAllAccounts();
      this.logger.log(
        `✓ Sync done — ${result.succeeded}/${result.total} OK, ${result.failed} failed`,
      );
    } catch (err: any) {
      this.logger.error(`Scheduled sync error: ${err.message}`);
    }
  }
}

@Module({
  imports:     [SecurityModule],
  providers:   [IspTrackingService, WeApiClient, IspScheduler],
  controllers: [IspTrackingController],
  exports:     [IspTrackingService],
})
export class IspTrackingModule {}
