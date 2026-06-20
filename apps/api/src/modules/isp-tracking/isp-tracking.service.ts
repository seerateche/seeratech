// ============================================================
// SEERA PLATFORM v4 - ISP Tracking Service
// Handles WE Telecom quota sync, account CRUD, session caching
// ============================================================
import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../../database/database.module';
import { ispAccounts, companies, IspQuotaDetails } from '../../database/schema';
import { SecurityService } from '../../security/security.service';
import { WeApiClient } from './we-api.client';

// ── DTOs ──────────────────────────────────────────────────────

export interface CreateIspAccountDto {
  accountName:  string;
  phoneNumber:  string;
  password:     string;
  provider?:    string;
}

export interface UpdateIspAccountDto {
  accountName?: string;
  password?:    string;
}

export interface IspAccountPublic {
  id:             string;
  companyId:      string;
  accountName:    string;
  phoneNumber:    string;
  provider:       string;
  status:         string;
  lastError:      string | null;
  quotaDetails:   IspQuotaDetails;
  lastSyncedAt:   string | null;
  createdAt:      string;
}

@Injectable()
export class IspTrackingService {
  private readonly logger = new Logger(IspTrackingService.name);
  // In-progress sync set — prevents double-syncing the same account
  private readonly syncInProgress = new Set<string>();

  constructor(
    @Inject(DRIZZLE_TOKEN)  private readonly db: DrizzleDB,
    private readonly security:   SecurityService,
    private readonly weClient:   WeApiClient,
  ) {}

  // ── Create ────────────────────────────────────────────────────

  async createAccount(
    companyId:  string,
    dto:        CreateIspAccountDto,
    createdBy?: string,
  ): Promise<IspAccountPublic> {
    // Validate phone format — Egyptian landline 0X5XXXXXXX or 0X3XXXXXXX
    const phone = dto.phoneNumber.replace(/\s|-/g, '');
    if (!/^0[23]\d{8}$/.test(phone)) {
      throw new BadRequestException(
        'صيغة رقم الهاتف غير صحيحة — يجب أن يكون 10 أرقام يبدأ بـ 02 أو 03',
      );
    }

    // Check duplicate phone per company
    const existing = await this.db
      .select({ id: ispAccounts.id })
      .from(ispAccounts)
      .where(
        and(
          eq(ispAccounts.companyId,  companyId),
          eq(ispAccounts.phoneNumber, phone),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        `رقم الهاتف ${phone} مسجل مسبقاً في هذه الشركة`,
      );
    }

    // Encrypt password
    const encrypted = this.security.encrypt(dto.password);

    const [account] = await this.db
      .insert(ispAccounts)
      .values({
        companyId,
        accountName:       dto.accountName.trim(),
        phoneNumber:       phone,
        encryptedPassword: `${encrypted.iv}:${encrypted.ciphertext}`,
        credentialIv:      encrypted.iv,
        credentialTag:     encrypted.tag,
        provider:          dto.provider ?? 'we_telecom',
        createdBy,
        quotaDetails:      {},
      })
      .returning();

    this.logger.log(`ISP account created: ${phone} for company ${companyId}`);
    return this.toPublic(account);
  }

  // ── Read ──────────────────────────────────────────────────────

  async listAccounts(companyId: string): Promise<IspAccountPublic[]> {
    const rows = await this.db
      .select()
      .from(ispAccounts)
      .where(eq(ispAccounts.companyId, companyId))
      .orderBy(desc(ispAccounts.createdAt));

    return rows.map(this.toPublic.bind(this));
  }

  async getAccount(id: string, companyId: string): Promise<IspAccountPublic> {
    const [account] = await this.db
      .select()
      .from(ispAccounts)
      .where(
        and(eq(ispAccounts.id, companyId ? id : id),
            eq(ispAccounts.companyId, companyId)),
      )
      .limit(1);

    if (!account) throw new NotFoundException('الحساب غير موجود');
    return this.toPublic(account);
  }

  // ── Update ────────────────────────────────────────────────────

  async updateAccount(
    id:        string,
    companyId: string,
    dto:       UpdateIspAccountDto,
  ): Promise<IspAccountPublic> {
    await this.assertExists(id, companyId);

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (dto.accountName) updates.accountName = dto.accountName.trim();

    if (dto.password) {
      const enc = this.security.encrypt(dto.password);
      updates.encryptedPassword = `${enc.iv}:${enc.ciphertext}`;
      updates.credentialIv      = enc.iv;
      updates.credentialTag     = enc.tag;
      // Invalidate cached session when password changes
      updates.encryptedSessionToken = null;
      updates.sessionTokenExpiresAt = null;
    }

    const [updated] = await this.db
      .update(ispAccounts)
      .set(updates)
      .where(
        and(eq(ispAccounts.id, id), eq(ispAccounts.companyId, companyId)),
      )
      .returning();

    return this.toPublic(updated);
  }

  // ── Delete ────────────────────────────────────────────────────

  async deleteAccount(id: string, companyId: string): Promise<void> {
    await this.assertExists(id, companyId);
    await this.db
      .delete(ispAccounts)
      .where(
        and(eq(ispAccounts.id, id), eq(ispAccounts.companyId, companyId)),
      );
    this.logger.log(`ISP account deleted: ${id}`);
  }

  // ── Sync Quota ────────────────────────────────────────────────

  /**
   * Main sync method:
   * 1. Decrypt password from DB
   * 2. Try cached session token first (skip re-login if valid)
   * 3. Login to WE API if no valid session
   * 4. Fetch quota
   * 5. Transform → IspQuotaDetails
   * 6. Update DB
   */
  async syncAccountQuota(
    id:        string,
    companyId: string,
  ): Promise<IspAccountPublic> {
    if (this.syncInProgress.has(id)) {
      throw new BadRequestException('المزامنة جارية بالفعل — انتظر حتى تكتمل');
    }

    const [account] = await this.db
      .select()
      .from(ispAccounts)
      .where(
        and(eq(ispAccounts.id, id), eq(ispAccounts.companyId, companyId)),
      )
      .limit(1);

    if (!account) throw new NotFoundException('الحساب غير موجود');

    this.syncInProgress.add(id);

    // Mark as syncing
    await this.db
      .update(ispAccounts)
      .set({ status: 'syncing', lastError: null })
      .where(eq(ispAccounts.id, id));

    try {
      // 1. Decrypt password
      const [iv, ciphertext] = account.encryptedPassword.split(':');
      const password = this.security.decrypt({
        ciphertext,
        iv:  account.credentialIv,
        tag: account.credentialTag,
      });

      // 2. Check cached session token
      let token: string | null = null;
      let accountId = '';

      if (
        account.encryptedSessionToken &&
        account.sessionTokenExpiresAt &&
        new Date(account.sessionTokenExpiresAt) > new Date(Date.now() + 60_000)
      ) {
        // Session still valid (>1 min left)
        try {
          // Stored format is "iv:ciphertext:tag" (AES-256-GCM requires the tag).
          const [tIv, tCipher, tTag] = account.encryptedSessionToken.split(':');
          if (!tIv || !tCipher || !tTag) {
            throw new Error('legacy/invalid session token format');
          }
          token = this.security.decrypt({
            ciphertext: tCipher,
            iv:  tIv,
            tag: tTag,
          });
          this.logger.debug(`Using cached WE session for account ${id}`);
        } catch {
          token = null; // force re-login
        }
      }

      // 3. Login if no valid cached token
      if (!token) {
        this.logger.log(`Logging in to WE API for ${account.phoneNumber}`);
        let authResp;
        try {
          authResp = await this.weClient.login(account.phoneNumber, password);
        } catch (loginErr: any) {
          // Try web fallback if mobile API fails
          if (['SERVICE_UNAVAILABLE', 'UNEXPECTED_RESPONSE'].includes(loginErr.code)) {
            this.logger.warn('Mobile API failed, trying web fallback');
            authResp = await this.weClient.fetchQuotaWebFallback(account.phoneNumber, password)
              .then(() => null) // fallback returns account info directly
              .catch(() => { throw loginErr; }); // re-throw original
          } else {
            throw loginErr;
          }
        }

        if (authResp) {
          token     = authResp.token;
          accountId = authResp.accountId;

          // Cache encrypted session token (valid for expiresIn seconds).
          // Store as "iv:ciphertext:tag" so the GCM auth tag survives the
          // round-trip and the cached token actually decrypts on next use.
          const tokenEnc = this.security.encrypt(token);
          const expiresAt = new Date(Date.now() + (authResp.expiresIn - 60) * 1000);
          await this.db
            .update(ispAccounts)
            .set({
              encryptedSessionToken: `${tokenEnc.iv}:${tokenEnc.ciphertext}:${tokenEnc.tag}`,
              sessionTokenExpiresAt: expiresAt,
            })
            .where(eq(ispAccounts.id, id));
        }
      }

      // 4. Fetch quota
      const accountInfo = await this.weClient.fetchQuota(token!, accountId);

      // 5. Transform to IspQuotaDetails
      const mainBundle = accountInfo.bundles.find((b) => b.isMainBundle)
        ?? accountInfo.bundles[0];

      const usedGb      = mainBundle?.usedValue      ?? 0;
      const totalGb     = mainBundle?.totalValue      ?? 0;
      const remainingGb = mainBundle?.remainingValue  ?? Math.max(0, totalGb - usedGb);
      const usagePercent = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;

      let daysRemaining: number | undefined;
      if (mainBundle?.expiryDate) {
        const exp = new Date(mainBundle.expiryDate);
        daysRemaining = Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 86_400_000));
      }

      const quotaDetails: IspQuotaDetails = {
        planName:       accountInfo.planName,
        totalGb,
        usedGb,
        remainingGb,
        usagePercent,
        expiryDate:     mainBundle?.expiryDate,
        daysRemaining,
        accountNumber:  accountInfo.accountNumber,
        subscriberName: accountInfo.subscriberName,
        lineStatus:     accountInfo.lineStatus,
        addons: accountInfo.bundles
          .filter((b) => !b.isMainBundle)
          .map((b) => ({
            name:    b.bundleName,
            usedGb:  b.usedValue,
            totalGb: b.totalValue,
          })),
      };

      // 6. Persist
      const [updated] = await this.db
        .update(ispAccounts)
        .set({
          status:       'active',
          quotaDetails,
          lastSyncedAt: new Date(),
          lastError:    null,
          updatedAt:    new Date(),
        })
        .where(eq(ispAccounts.id, id))
        .returning();

      this.logger.log(
        `✓ Synced quota for ${account.phoneNumber}: ` +
        `${usedGb}/${totalGb} GB (${usagePercent}%)`,
      );

      return this.toPublic(updated);
    } catch (err: any) {
      // Graceful error — store Arabic message in DB, mark as error
      const errorMsg = err.isWeError
        ? err.message
        : `خطأ غير متوقع: ${err.message?.slice(0, 100) ?? 'unknown'}`;

      this.logger.error(`Sync failed for account ${id}: ${errorMsg}`);

      await this.db
        .update(ispAccounts)
        .set({
          status:    'error',
          lastError: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(ispAccounts.id, id));

      // Re-throw so controller can return proper HTTP status
      throw new InternalServerErrorException(errorMsg);
    } finally {
      this.syncInProgress.delete(id);
    }
  }

  // ── Scheduled Sync (all active accounts) ─────────────────────

  async syncAllAccounts(companyId?: string): Promise<{
    total: number;
    succeeded: number;
    failed: number;
  }> {
    const query = this.db
      .select({ id: ispAccounts.id, companyId: ispAccounts.companyId })
      .from(ispAccounts)
      .where(
        companyId
          ? and(eq(ispAccounts.companyId, companyId), eq(ispAccounts.status, 'active'))
          : eq(ispAccounts.status, 'active'),
      );

    const accounts = await query;
    let succeeded = 0;
    let failed    = 0;

    for (const acct of accounts) {
      try {
        await this.syncAccountQuota(acct.id, acct.companyId);
        succeeded++;
      } catch {
        failed++;
      }
      // Small delay between accounts to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { total: accounts.length, succeeded, failed };
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async assertExists(id: string, companyId: string) {
    const [row] = await this.db
      .select({ id: ispAccounts.id })
      .from(ispAccounts)
      .where(
        and(eq(ispAccounts.id, id), eq(ispAccounts.companyId, companyId)),
      )
      .limit(1);

    if (!row) throw new NotFoundException('الحساب غير موجود');
  }

  /** Strip sensitive fields from DB row before sending to client */
  private toPublic(account: any): IspAccountPublic {
    return {
      id:           account.id,
      companyId:    account.companyId,
      accountName:  account.accountName,
      phoneNumber:  account.phoneNumber,
      provider:     account.provider,
      status:       account.status,
      lastError:    account.lastError ?? null,
      quotaDetails: (account.quotaDetails as IspQuotaDetails) ?? {},
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      createdAt:    account.createdAt.toISOString(),
    };
  }
}
