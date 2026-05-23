// ============================================================
// SEERA PLATFORM v4 - ISP Tracking Service Tests
// Run: npx jest isp-tracking --testPathPattern=isp
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { IspTrackingService }  from './isp-tracking.service';
import { WeApiClient }         from './we-api.client';
import { SecurityService }     from '../../security/security.service';
import { DRIZZLE_TOKEN }       from '../../database/database.module';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

// ── Mock factories ────────────────────────────────────────────

const mockDb = {
  select:  jest.fn().mockReturnThis(),
  from:    jest.fn().mockReturnThis(),
  where:   jest.fn().mockReturnThis(),
  limit:   jest.fn().mockReturnThis(),
  insert:  jest.fn().mockReturnThis(),
  values:  jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update:  jest.fn().mockReturnThis(),
  set:     jest.fn().mockReturnThis(),
  delete:  jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
};

const mockSecurity = {
  encrypt: jest.fn().mockReturnValue({
    ciphertext: 'abc123',
    iv:  'deadbeef00000000',
    tag: 'cafebabe00000000',
  }),
  decrypt: jest.fn().mockReturnValue('decryptedPassword'),
};

const mockWeClient = {
  login:       jest.fn(),
  fetchQuota:  jest.fn(),
};

const COMPANY_ID  = 'comp-111';
const ACCOUNT_ID  = 'acct-222';
const MOCK_ACCOUNT = {
  id:                   ACCOUNT_ID,
  companyId:            COMPANY_ID,
  accountName:          'Test Cafe',
  phoneNumber:          '0351234567',
  encryptedPassword:    'iv:ciphertext',
  credentialIv:         'deadbeef00000000',
  credentialTag:        'cafebabe00000000',
  provider:             'we_telecom',
  status:               'active',
  lastError:            null,
  quotaDetails:         {},
  lastSyncedAt:         null,
  encryptedSessionToken: null,
  sessionTokenExpiresAt: null,
  createdAt:            new Date(),
  updatedAt:            new Date(),
};

// ── Test Suite ────────────────────────────────────────────────

describe('IspTrackingService', () => {
  let service: IspTrackingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: no existing accounts
    mockDb.limit.mockResolvedValue([]);
    mockDb.returning.mockResolvedValue([MOCK_ACCOUNT]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IspTrackingService,
        { provide: DRIZZLE_TOKEN,  useValue: mockDb },
        { provide: SecurityService, useValue: mockSecurity },
        { provide: WeApiClient,    useValue: mockWeClient },
      ],
    }).compile();

    service = module.get<IspTrackingService>(IspTrackingService);
  });

  // ── createAccount ──────────────────────────────────────────

  describe('createAccount', () => {
    it('creates account with valid phone number', async () => {
      const result = await service.createAccount(COMPANY_ID, {
        accountName:  'Test Cafe',
        phoneNumber:  '0351234567',
        password:     'mypassword',
      });

      expect(mockSecurity.encrypt).toHaveBeenCalledWith('mypassword');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.phoneNumber).toBe('0351234567');
      expect(result).not.toHaveProperty('encryptedPassword');
    });

    it('rejects invalid phone format', async () => {
      await expect(
        service.createAccount(COMPANY_ID, {
          accountName: 'Test',
          phoneNumber: '01234567890', // mobile number, not landline
          password:    'pass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate phone in same company', async () => {
      // Simulate existing record found
      mockDb.limit.mockResolvedValueOnce([{ id: 'existing' }]);

      await expect(
        service.createAccount(COMPANY_ID, {
          accountName: 'Duplicate',
          phoneNumber: '0351234567',
          password:    'pass123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('strips spaces from phone number', async () => {
      const result = await service.createAccount(COMPANY_ID, {
        accountName: 'Test',
        phoneNumber: '035 123 4567',
        password:    'pass123',
      });
      expect(result.phoneNumber).toBe('0351234567');
    });
  });

  // ── syncAccountQuota ───────────────────────────────────────

  describe('syncAccountQuota', () => {
    beforeEach(() => {
      // First limit call returns the account
      mockDb.limit.mockResolvedValue([MOCK_ACCOUNT]);
      mockDb.returning.mockResolvedValue([{
        ...MOCK_ACCOUNT,
        status:      'active',
        lastSyncedAt: new Date(),
        quotaDetails: {
          planName:     'Super Speed 1 - 250GB',
          totalGb:      250,
          usedGb:       180.5,
          remainingGb:  69.5,
          usagePercent: 72,
          expiryDate:   '2025-12-31',
          daysRemaining: 15,
        },
      }]);
    });

    it('successfully syncs quota via WE API', async () => {
      mockWeClient.login.mockResolvedValue({
        token:          'bearer-token',
        refreshToken:   'refresh-token',
        expiresIn:      3600,
        accountId:      'WE12345',
        subscriberName: 'AHMED SALAH',
      });

      mockWeClient.fetchQuota.mockResolvedValue({
        accountNumber:  'WE12345',
        subscriberName: 'AHMED SALAH',
        lineStatus:     'Active',
        planName:       'Super Speed 1 - 250GB',
        bundles: [{
          bundleName:    'Super Speed 1 - 250GB',
          totalValue:    250,
          usedValue:     180.5,
          remainingValue: 69.5,
          unit:          'GB',
          expiryDate:    '2025-12-31',
          isMainBundle:  true,
        }],
      });

      const result = await service.syncAccountQuota(ACCOUNT_ID, COMPANY_ID);

      expect(mockWeClient.login).toHaveBeenCalledWith('0351234567', 'decryptedPassword');
      expect(mockWeClient.fetchQuota).toHaveBeenCalled();
      expect(result.quotaDetails.usedGb).toBe(180.5);
      expect(result.quotaDetails.usagePercent).toBe(72);
    });

    it('stores Arabic error message on WE API failure', async () => {
      const weError: any = new Error('كلمة المرور أو رقم الهاتف غير صحيح');
      weError.isWeError = true;
      weError.code      = 'INVALID_CREDENTIALS';
      mockWeClient.login.mockRejectedValue(weError);

      mockDb.returning.mockResolvedValue([{
        ...MOCK_ACCOUNT,
        status:    'error',
        lastError: 'كلمة المرور أو رقم الهاتف غير صحيح',
      }]);

      await expect(
        service.syncAccountQuota(ACCOUNT_ID, COMPANY_ID),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify Arabic error was written to DB
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status:    'error',
          lastError: expect.stringContaining('كلمة المرور'),
        }),
      );
    });

    it('prevents double-sync on same account', async () => {
      // Simulate sync already in progress
      (service as any).syncInProgress.add(ACCOUNT_ID);

      await expect(
        service.syncAccountQuota(ACCOUNT_ID, COMPANY_ID),
      ).rejects.toThrow(BadRequestException);

      // Cleanup
      (service as any).syncInProgress.delete(ACCOUNT_ID);
    });

    it('throws NotFoundException for unknown account', async () => {
      mockDb.limit.mockResolvedValue([]); // not found

      await expect(
        service.syncAccountQuota('nonexistent-id', COMPANY_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── listAccounts ───────────────────────────────────────────

  describe('listAccounts', () => {
    it('returns accounts without sensitive fields', async () => {
      mockDb.orderBy = jest.fn().mockResolvedValue([MOCK_ACCOUNT]);

      const results = await service.listAccounts(COMPANY_ID);

      expect(results.length).toBe(1);
      // Sensitive fields must NOT be in response
      results.forEach((r) => {
        expect(r).not.toHaveProperty('encryptedPassword');
        expect(r).not.toHaveProperty('credentialIv');
        expect(r).not.toHaveProperty('credentialTag');
        expect(r).not.toHaveProperty('encryptedSessionToken');
      });
    });
  });

  // ── deleteAccount ──────────────────────────────────────────

  describe('deleteAccount', () => {
    it('deletes existing account', async () => {
      mockDb.limit.mockResolvedValue([{ id: ACCOUNT_ID }]);
      mockDb.delete.mockReturnThis();
      mockDb.where.mockResolvedValue(undefined);

      await expect(
        service.deleteAccount(ACCOUNT_ID, COMPANY_ID),
      ).resolves.not.toThrow();
    });

    it('throws NotFoundException for non-existent account', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(
        service.deleteAccount('ghost-id', COMPANY_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
