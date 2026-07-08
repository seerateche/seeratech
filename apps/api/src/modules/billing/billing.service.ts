import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { invoices, expenses, quotations, transactions, vodafoneCashTransfers } from '../../database/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

@Injectable()
export class BillingService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  async getSummary(companyId: string) {
    // 1. Total Expenses
    const expResult = await this.db
      .select({ total: sql<number>`SUM(${expenses.amount})` })
      .from(expenses)
      .where(eq(expenses.companyId, companyId));
    
    // 2. Total Revenue (Paid Invoices)
    const revResult = await this.db
      .select({ total: sql<number>`SUM(${invoices.amount})` })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, companyId),
        eq(invoices.status, 'paid')
      ));

    // 3. Vodafone Cash Balance (Income - Expense for VFCash)
    const vfIncomeResult = await this.db
      .select({ total: sql<number>`SUM(${transactions.amount})` })
      .from(transactions)
      .where(and(
        eq(transactions.companyId, companyId),
        eq(transactions.paymentMethod, 'vodafone_cash'),
        eq(transactions.type, 'income')
      ));

    const vfExpenseResult = await this.db
      .select({ total: sql<number>`SUM(${transactions.amount})` })
      .from(transactions)
      .where(and(
        eq(transactions.companyId, companyId),
        eq(transactions.paymentMethod, 'vodafone_cash'),
        eq(transactions.type, 'expense')
      ));

    const totalRevenue = revResult[0]?.total || 0;
    const totalExpenses = expResult[0]?.total || 0;
    const vfCashBalance = (vfIncomeResult[0]?.total || 0) - (vfExpenseResult[0]?.total || 0);

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      vfCashBalance,
    };
  }

  async getInvoices(companyId: string) {
    return this.db.query.invoices.findMany({
      where: eq(invoices.companyId, companyId),
      orderBy: [desc(invoices.createdAt)],
    });
  }

  async getQuotations(companyId: string) {
    return this.db.query.quotations.findMany({
      where: eq(quotations.companyId, companyId),
      orderBy: [desc(quotations.createdAt)],
    });
  }

  async getExpenses(companyId: string) {
    return this.db.query.expenses.findMany({
      where: eq(expenses.companyId, companyId),
      orderBy: [desc(expenses.expenseDate)],
    });
  }
}
