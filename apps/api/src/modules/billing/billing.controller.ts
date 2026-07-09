import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CreateQuotationDto, CreateInvoiceDto, CreateExpenseDto, CreateSubscriptionOfferDto } from './billing.dto';
import { JwtAuthGuard } from '../auth/auth.service';
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

  @Post('quotations')
  @ApiOperation({ summary: 'Create a new quotation' })
  createQuotation(@Request() req: any, @Body() data: CreateQuotationDto) {
    return this.billingService.createQuotation(req.user.companyId, data);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get all expenses' })
  getExpenses(@Request() req: any) {
    return this.billingService.getExpenses(req.user.companyId);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create a new invoice' })
  createInvoice(@Request() req: any, @Body() data: CreateInvoiceDto) {
    return this.billingService.createInvoice(req.user.companyId, data);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Create a new expense' })
  createExpense(@Request() req: any, @Body() data: CreateExpenseDto) {
    return this.billingService.createExpense(req.user.companyId, data);
  }

  @Get('packages')
  @ApiOperation({ summary: 'Get subscription packages' })
  getSubscriptionOffers(@Request() req: any) {
    return this.billingService.getSubscriptionOffers(req.user.companyId);
  }

  @Post('packages')
  @ApiOperation({ summary: 'Create a subscription package' })
  createSubscriptionOffer(@Request() req: any, @Body() data: CreateSubscriptionOfferDto) {
    return this.billingService.createSubscriptionOffer(req.user.companyId, data);
  }
}
