// ============================================================
// SEERA PLATFORM v4 - Companies Module
// ============================================================
import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { AdminController, DashboardController } from './companies.controller';

@Module({
  controllers: [AdminController, DashboardController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
