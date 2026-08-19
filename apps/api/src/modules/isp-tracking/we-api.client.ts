// ============================================================
// SEERA PLATFORM v4 - WE Telecom API Client
// Reverse-engineered "My WE" mobile app API (Egypt)
// Handles auth, quota fetch, and graceful error mapping to Arabic
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
} from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// ── API response shapes ───────────────────────────────────────

export interface WeAuthResponse {
  token:        string;
  refreshToken: string;
  expiresIn:    number;   // seconds
  accountId:    string;
  subscriberName: string;
}

export interface WeQuotaBundle {
  bundleName:    string;
  totalValue:    number;  // GB
  usedValue:     number;
  remainingValue: number;
  unit:          string;  // 'GB'
  expiryDate:    string;
  isMainBundle:  boolean;
}

export interface WeAccountInfo {
  accountNumber:  string;
  subscriberName: string;
  lineStatus:     string;   // 'Active' | 'Barred' etc.
  planName:       string;
  bundles:        WeQuotaBundle[];
}

// Arabic error messages for known failure modes
const WE_ERROR_MAP: Record<string, string> = {
  'INVALID_CREDENTIALS':   'كلمة المرور أو رقم الهاتف غير صحيح',
  'ACCOUNT_LOCKED':        'الحساب محظور مؤقتاً — يرجى المحاولة لاحقاً',
  'ACCOUNT_NOT_FOUND':     'رقم الهاتف غير مسجل في خدمة My WE',
  'SERVICE_UNAVAILABLE':   'خدمة WE غير متاحة حالياً — حاول مرة أخرى',
  'SESSION_EXPIRED':       'انتهت صلاحية الجلسة — سيتم تجديدها تلقائياً',
  'QUOTA_NOT_FOUND':       'لا توجد بيانات كوتا لهذا الحساب',
  'RATE_LIMITED':          'تم حظر الطلبات مؤقتاً من WE — انتظر 15 دقيقة',
  'NETWORK_ERROR':         'تعذّر الوصول إلى سيرفرات WE — تحقق من الاتصال',
  'UNEXPECTED_RESPONSE':   'استجابة غير متوقعة من WE — قد يكون API قد تغيّر',
};

@Injectable()
export class WeApiClient {
  private readonly logger = new Logger(WeApiClient.name);

  // ── Base URL — My WE mobile app API ──────────────────────────
  // Discovered via MITM proxy of the My WE Android app v6.x
  private readonly BASE_URL = 'https://my.te.eg/api';

  // Endpoints (all POST unless noted)
  private readonly ENDPOINTS = {
    login:        '/v1/oauth/token',
    accountInfo:  '/v1/subscriber/info',
    quota:        '/v1/subscriber/quota',
    addons:       '/v1/subscriber/addons',
    refresh:      '/v1/oauth/refresh',
  };

  // ── Standard My WE app headers ───────────────────────────────
  // Mimic the Android app to avoid bot detection
  private readonly MOBILE_HEADERS: Record<string, string> = {
    'User-Agent':      'MyWE/6.5.0 (Android; API 30; Build/RP1A.201005.001)',
    'Content-Type':    'application/json',
    'Accept':          'application/json',
    'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8',
    'X-App-Version':   '6.5.0',
    'X-Platform':      'android',
    'X-Device-Model':  'Samsung Galaxy A52',
    'X-OS-Version':    '11',
    'Cache-Control':   'no-cache',
    'Connection':      'keep-alive',
  };

  private readonly http: AxiosInstance;

  // ── Landline (ADSL) real-quota scraper ───────────────────────
  // The WE *landline* portal authenticates with a portal
  // username/password (NOT mobile OTP), which is why a headless
  // scrape of it returns real quota reliably. We POST the credentials
  // to a scraper microservice that logs into the portal and returns
  // parsed usage.
  //
  //   POST <WE_SCRAPER_URL>
  //   body: { phoneNumber, username, password, provider }
  //   ->   { planName, totalGB, usedGB, remainingGB, percent,
  //          renewalDate, lineStatus, balance }
  //
  // WE blocks datacenter IPs, so real scraping requires an Egyptian
  // residential/mobile egress. WE_SCRAPER_PROXY_URL routes the request
  // through such a proxy. Without a configured scraper URL the landline
  // path is disabled and the caller falls back to labelled demo data.
  private readonly SCRAPER_URL =
    process.env.WE_SCRAPER_URL?.trim() || '';
  private readonly SCRAPER_PROXY_URL =
    process.env.WE_SCRAPER_PROXY_URL?.trim() || '';
  private readonly SCRAPER_TIMEOUT_MS = Number(
    process.env.WE_SCRAPER_TIMEOUT_MS ?? 45_000,
  );

  /** True when a landline scraper endpoint is configured. */
  get landlineScraperEnabled(): boolean {
    return this.SCRAPER_URL.length > 0;
  }

  constructor() {
    this.http = axios.create({
      baseURL: this.BASE_URL,
      timeout: 20_000,
      headers: this.MOBILE_HEADERS,
      // Follow redirects
      maxRedirects: 5,
      // Validate status: accept 2xx AND 401 (handle it ourselves)
      validateStatus: (status) => status < 500,
    });

    // Request logging (debug only)
    this.http.interceptors.request.use((config) => {
      this.logger.debug(`WE API → ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response logging
    this.http.interceptors.response.use(
      (res) => {
        this.logger.debug(`WE API ← ${res.status} ${res.config.url}`);
        return res;
      },
      (err: AxiosError) => {
        this.logger.warn(`WE API error: ${err.message}`);
        return Promise.reject(err);
      },
    );
  }

  // ── Authentication ────────────────────────────────────────────

  /**
   * Login with phone number + password.
   * Wraps the My WE OAuth endpoint.
   * Returns the bearer token + account ID on success.
   */
  async login(phoneNumber: string, password: string): Promise<WeAuthResponse> {
    try {
      const res = await this.http.post(this.ENDPOINTS.login, {
        // My WE uses OAuth2 Resource Owner Password Grant
        grant_type: 'password',
        username:   phoneNumber.replace(/^0/, '+20'), // 035xxxxxx → +2035xxxxxx
        password,
        client_id:  'mywe-android',
        scope:      'subscriber',
      });

      if (res.status === 401) {
        throw this.makeError('INVALID_CREDENTIALS');
      }

      if (res.status === 429) {
        throw this.makeError('RATE_LIMITED');
      }

      const data = res.data;

      // Validate response shape
      if (!data?.access_token) {
        this.logger.warn('Unexpected WE auth response shape', JSON.stringify(data).slice(0, 200));
        throw this.makeError('UNEXPECTED_RESPONSE');
      }

      return {
        token:          data.access_token,
        refreshToken:   data.refresh_token ?? '',
        expiresIn:      data.expires_in   ?? 3600,
        accountId:      data.subscriber_id ?? data.account_id ?? '',
        subscriberName: data.subscriber_name ?? data.name ?? '',
      };
    } catch (err: any) {
      // Do NOT silently return a fake token — that hides real failures.
      // Map to a proper WE error so the caller can decide how to react
      // (e.g. fall back to clearly-labelled mock data, or surface the error).
      if (err?.isWeError) throw err;
      this.logger.warn(`WE API login failed for ${phoneNumber}: ${err?.message ?? 'unknown'}`);
      throw this.mapAxiosError(err);
    }
  }

  // ── Quota Fetch ───────────────────────────────────────────────

  /**
   * Fetches the full quota breakdown using a valid bearer token.
   */
  async fetchQuota(token: string, accountId: string): Promise<WeAccountInfo> {
    try {
      const authHeader = { Authorization: `Bearer ${token}` };

      // Parallel calls: account info + quota bundles
      const [infoRes, quotaRes] = await Promise.all([
        this.http.get(this.ENDPOINTS.accountInfo, {
          headers: authHeader,
          params: { accountId },
        }),
        this.http.get(this.ENDPOINTS.quota, {
          headers: authHeader,
          params: { accountId },
        }),
      ]);

      if (infoRes.status === 401 || quotaRes.status === 401) {
        throw this.makeError('SESSION_EXPIRED');
      }

      const infoData  = infoRes.data;
      const quotaData = quotaRes.data;

      if (!quotaData) {
        throw this.makeError('QUOTA_NOT_FOUND');
      }

      // ── Normalize response ─────────────────────────────────
      // The My WE API wraps data in a `data` or `result` envelope
      const quota  = quotaData?.data ?? quotaData?.result ?? quotaData;
      const info   = infoData?.data  ?? infoData?.result  ?? infoData;

      // Build bundles array from various response shapes
      const bundles: WeQuotaBundle[] = this.normalizeBundles(quota);

      return {
        accountNumber:  info?.account_number  ?? info?.msisdn   ?? accountId,
        subscriberName: info?.subscriber_name ?? info?.name     ?? '',
        lineStatus:     info?.status          ?? info?.line_status ?? 'Active',
        planName:       info?.plan_name       ?? info?.package_name
                          ?? bundles[0]?.bundleName
                          ?? 'غير محدد',
        bundles,
      };
    } catch (err: any) {
      // Surface the real failure instead of masking it with fake numbers.
      if (err?.isWeError) throw err;
      this.logger.warn(`WE API quota fetch failed: ${err?.message ?? 'unknown'}`);
      throw this.mapAxiosError(err);
    }
  }

  // ── Landline (ADSL) Real Quota via Scraper ───────────────────

  /**
   * Fetches REAL landline quota by POSTing the portal credentials to the
   * configured scraper microservice. Returns a WeAccountInfo so it flows
   * through the same transformAccountInfo() path as the mobile API.
   *
   * @throws a WE-mapped error (isWeError) on any failure, so the caller can
   *         decide whether to surface it or fall back to labelled demo data.
   */
  async fetchLandlineQuota(params: {
    phoneNumber: string;
    username:    string;
    password:    string;
    provider?:   string;
  }): Promise<WeAccountInfo> {
    if (!this.landlineScraperEnabled) {
      // No scraper configured — caller falls back to demo data.
      throw this.makeError('SERVICE_UNAVAILABLE');
    }

    const reqConfig: AxiosRequestConfig = {
      timeout: this.SCRAPER_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status < 500,
    };

    // Route through an Egyptian egress proxy when configured. WE blocks
    // datacenter IPs, so without this the scrape will almost always fail.
    if (this.SCRAPER_PROXY_URL) {
      const agent = new HttpsProxyAgent(this.SCRAPER_PROXY_URL);
      reqConfig.httpAgent  = agent;
      reqConfig.httpsAgent = agent;
      // Let the proxy agent handle the tunnel, not axios' proxy option.
      reqConfig.proxy = false;
    } else {
      this.logger.warn(
        'WE_SCRAPER_PROXY_URL is not set — landline scrape will use the ' +
        'server IP directly and will likely be blocked by WE.',
      );
    }

    try {
      const res = await axios.post(
        this.SCRAPER_URL,
        {
          phoneNumber: params.phoneNumber,
          username:    params.username || params.phoneNumber,
          password:    params.password,
          provider:    params.provider || 'WE',
        },
        reqConfig,
      );

      if (res.status === 401 || res.status === 403) {
        throw this.makeError('INVALID_CREDENTIALS');
      }
      if (res.status === 429) {
        throw this.makeError('RATE_LIMITED');
      }

      const data = res.data?.data ?? res.data;
      if (!data || !data.planName) {
        this.logger.warn(
          `Landline scrape returned no plan for ${params.phoneNumber}: ` +
          `${JSON.stringify(data).slice(0, 200)}`,
        );
        throw this.makeError('UNEXPECTED_RESPONSE');
      }

      return this.mapLandlineResponse(data, params.phoneNumber);
    } catch (err: any) {
      if (err?.isWeError) throw err;
      this.logger.warn(
        `Landline scrape failed for ${params.phoneNumber}: ${err?.message ?? 'unknown'}`,
      );
      throw this.mapAxiosError(err);
    }
  }

  /**
   * Maps the scraper's landline response into the shared WeAccountInfo
   * shape. Tolerant of both camelCase and PascalCase keys, since the
   * upstream response is not a formally-versioned contract.
   */
  private mapLandlineResponse(raw: any, phoneNumber: string): WeAccountInfo {
    const num = (v: any): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };

    const totalGb = num(raw.totalGB ?? raw.totalGb ?? raw.total);
    const usedGb  = num(raw.usedGB  ?? raw.usedGb  ?? raw.used);
    const remainingGb = raw.remainingGB ?? raw.remainingGb ?? raw.remaining;
    const remaining = remainingGb != null ? num(remainingGb) : Math.max(0, totalGb - usedGb);
    const expiry = raw.renewalDate ?? raw.RenewalDate ?? raw.expiryDate ?? raw.expiry ?? '';

    return {
      accountNumber:  String(raw.accountNumber ?? raw.phoneNumber ?? phoneNumber),
      subscriberName: String(raw.subscriberName ?? raw.name ?? ''),
      lineStatus:     String(raw.lineStatus ?? raw.status ?? 'Active'),
      planName:       String(raw.planName),
      bundles: [
        {
          bundleName:     'Main Quota',
          totalValue:     totalGb,
          usedValue:      usedGb,
          remainingValue: remaining,
          unit:           'GB',
          expiryDate:     expiry ? new Date(expiry).toISOString() : '',
          isMainBundle:   true,
        },
      ],
    };
  }

  // ── Demo / Placeholder Data ──────────────────────────────────

  /**
   * Returns clearly-labelled DEMO quota data.
   *
   * ⚠️  This is NOT real data. WE (Telecom Egypt) does not expose a
   * public quota API, and their portal requires OTP / bot protection
   * that blocks server-side automation. Until a real integration is
   * available, callers may use this so the dashboard stays functional —
   * but the returned payload is explicitly flagged as mock and the UI
   * must display a "بيانات تجريبية" banner. Never present this as live.
   */
  buildMockAccountInfo(phoneNumber: string, accountId?: string): WeAccountInfo {
    return {
      accountNumber:  accountId || phoneNumber,
      subscriberName: 'عميل WE (بيانات تجريبية)',
      lineStatus:     'Active',
      planName:       'WE Space Super 250GB (تجريبي)',
      bundles: [
        {
          bundleName:     'Main Quota',
          totalValue:     250,
          usedValue:      115,
          remainingValue: 135,
          unit:           'GB',
          expiryDate:     new Date(Date.now() + 15 * 86400000).toISOString(),
          isMainBundle:   true,
        },
      ],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────

  private normalizeBundles(quota: any): WeQuotaBundle[] {
    if (!quota) return [];

    // Handle array of bundles
    const rawBundles: any[] =
      quota.bundles   ??
      quota.packages  ??
      quota.quotas    ??
      (Array.isArray(quota) ? quota : [quota]);

    return rawBundles
      .filter(Boolean)
      .map((b: any, idx: number) => ({
        bundleName:     b.bundle_name   ?? b.name         ?? b.package_name ?? `Bundle ${idx + 1}`,
        totalValue:     parseFloat(b.total_value   ?? b.total    ?? b.quota      ?? 0),
        usedValue:      parseFloat(b.used_value    ?? b.used     ?? b.consumed   ?? 0),
        remainingValue: parseFloat(b.remain_value  ?? b.remaining ?? b.balance   ?? 0),
        unit:           (b.unit ?? b.quota_unit ?? 'GB').toUpperCase(),
        expiryDate:     b.expiry_date ?? b.expiry ?? b.end_date ?? '',
        isMainBundle:   b.is_main ?? idx === 0,
      }));
  }

  private makeError(code: keyof typeof WE_ERROR_MAP): Error & { isWeError: boolean; code: string } {
    const err = new Error(WE_ERROR_MAP[code] ?? code) as any;
    err.isWeError = true;
    err.code = code;
    return err;
  }

  private mapAxiosError(err: any): Error & { isWeError: boolean } {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return this.makeError('NETWORK_ERROR');
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      return this.makeError('SERVICE_UNAVAILABLE');
    }
    if (err.response?.status === 429) return this.makeError('RATE_LIMITED');
    if (err.response?.status === 401) return this.makeError('SESSION_EXPIRED');
    if (err.response?.status >= 500) return this.makeError('SERVICE_UNAVAILABLE');
    return this.makeError('UNEXPECTED_RESPONSE');
  }
}
