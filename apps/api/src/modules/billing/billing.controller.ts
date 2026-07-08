import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../security/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get billing summary and Vodafone Cash balance' })
  getSummary(@Request() req: any) {
    return this.billingService.getSummary(req.user.companyId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get all invoices' })
  getInvoices(@Request() req: any) {
    return this.billingService.getInvoices(req.user.companyId);
  }

  @Get('quotations')
  @ApiOperation({ summary: 'Get all quotations' })
  getQuotations(@Request() req: any) {
    return this.billingService.getQuotations(req.user.companyId);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get all expenses' })
  getExpenses(@Request() req: any) {
    return this.billingService.getExpenses(req.user.companyId);
  }
}
