// ============================================================
// SEERA PLATFORM v4 - WE API Client Tests (landline scraper)
// Run: npm test -- we-api
// ============================================================
import axios from 'axios';
import { WeApiClient } from './we-api.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeApiClient — landline scraper', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    // The constructor calls axios.create() for the mobile HTTP instance;
    // return a stub with the interceptor hooks it wires up.
    mockedAxios.create.mockReturnValue({
      interceptors: {
        request:  { use: jest.fn() },
        response: { use: jest.fn() },
      },
      post: jest.fn(),
      get:  jest.fn(),
    } as any);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // ── landlineScraperEnabled flag ─────────────────────────────

  it('is disabled when WE_SCRAPER_URL is unset', () => {
    delete process.env.WE_SCRAPER_URL;
    const client = new WeApiClient();
    expect(client.landlineScraperEnabled).toBe(false);
  });

  it('is enabled when WE_SCRAPER_URL is set', () => {
    process.env.WE_SCRAPER_URL = 'https://scraper.example.com/scrape';
    const client = new WeApiClient();
    expect(client.landlineScraperEnabled).toBe(true);
  });

  // ── fetchLandlineQuota happy path ───────────────────────────

  it('maps a camelCase scraper response into WeAccountInfo', async () => {
    process.env.WE_SCRAPER_URL = 'https://scraper.example.com/scrape';
    const client = new WeApiClient();

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        planName:    'Super speed 1- (250GB)',
        totalGB:     250,
        usedGB:      194.95,
        remainingGB: 55.05,
        percent:     78,
        renewalDate: '2026-08-10',
        lineStatus:  'Active',
        balance:     0.01,
      },
    } as any);

    const info = await client.fetchLandlineQuota({
      phoneNumber: '035130247',
      username:    '035130247',
      password:    'secret',
    });

    expect(info.planName).toBe('Super speed 1- (250GB)');
    expect(info.lineStatus).toBe('Active');
    expect(info.bundles).toHaveLength(1);
    const b = info.bundles[0];
    expect(b.isMainBundle).toBe(true);
    expect(b.totalValue).toBe(250);
    expect(b.usedValue).toBe(194.95);
    expect(b.remainingValue).toBe(55.05);
    expect(b.expiryDate).toContain('2026-08-10');
  });

  it('tolerates PascalCase / alternate keys and derives remaining when absent', async () => {
    process.env.WE_SCRAPER_URL = 'https://scraper.example.com/scrape';
    const client = new WeApiClient();

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        planName:    'Super Mega 140GB',
        total:       140,
        used:        94.5,
        // no remaining* provided -> should be derived (140 - 94.5)
        RenewalDate: '2026-09-01',
        status:      'Active',
      },
    } as any);

    const info = await client.fetchLandlineQuota({
      phoneNumber: '035048392',
      username:    '035048392',
      password:    'secret',
    });

    expect(info.bundles[0].totalValue).toBe(140);
    expect(info.bundles[0].usedValue).toBe(94.5);
    expect(info.bundles[0].remainingValue).toBeCloseTo(45.5, 2);
  });

  // ── error paths ─────────────────────────────────────────────

  it('throws a WE error (SERVICE_UNAVAILABLE) when scraper is not configured', async () => {
    delete process.env.WE_SCRAPER_URL;
    const client = new WeApiClient();

    await expect(
      client.fetchLandlineQuota({
        phoneNumber: '035130247',
        username:    '035130247',
        password:    'secret',
      }),
    ).rejects.toMatchObject({ isWeError: true, code: 'SERVICE_UNAVAILABLE' });

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('maps 401 to INVALID_CREDENTIALS', async () => {
    process.env.WE_SCRAPER_URL = 'https://scraper.example.com/scrape';
    const client = new WeApiClient();

    mockedAxios.post.mockResolvedValue({ status: 401, data: {} } as any);

    await expect(
      client.fetchLandlineQuota({
        phoneNumber: '035130247',
        username:    '035130247',
        password:    'wrong',
      }),
    ).rejects.toMatchObject({ isWeError: true, code: 'INVALID_CREDENTIALS' });
  });

  it('throws UNEXPECTED_RESPONSE when planName is missing', async () => {
    process.env.WE_SCRAPER_URL = 'https://scraper.example.com/scrape';
    const client = new WeApiClient();

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { totalGB: 250, usedGB: 100 },
    } as any);

    await expect(
      client.fetchLandlineQuota({
        phoneNumber: '035130247',
        username:    '035130247',
        password:    'secret',
      }),
    ).rejects.toMatchObject({ isWeError: true, code: 'UNEXPECTED_RESPONSE' });
  });
});
