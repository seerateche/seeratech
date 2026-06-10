// ============================================================
// SEERA PLATFORM v4 - MikroTik Enterprise Module DTOs (Phase A-F)
// class-validator request bodies for the new endpoints.
// Mirrors the additive interfaces declared in @sira/shared.
// ============================================================
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ── Phase B: Interface Management ─────────────────────────────

export class InterfaceActionBody {
  @IsUUID() deviceId: string;
  /** RouterOS interface name (e.g. "ether1") OR internal .id */
  @IsString() @IsNotEmpty() interface: string;
}

export class InterfaceCommentBody extends InterfaceActionBody {
  @IsString() @MaxLength(255) comment: string;
}

// ── Phase C: PPPoE Management ─────────────────────────────────

export class CreatePppoeUserBody {
  @IsUUID() deviceId: string;
  @IsString() @IsNotEmpty() @MaxLength(64) name: string;
  @IsString() @IsNotEmpty() @MaxLength(128) password: string;
  @IsOptional() @IsString() profile?: string;
  @IsOptional() @IsString() service?: string; // default "any"
  @IsOptional() @IsString() rateLimit?: string; // e.g. "10M/2M"
  @IsOptional() @IsString() @MaxLength(255) comment?: string;
  @IsOptional() @IsBoolean() disabled?: boolean;
}

export class UpdatePppoeUserBody {
  @IsUUID() deviceId: string;
  @IsOptional() @IsString() @MaxLength(128) password?: string;
  @IsOptional() @IsString() profile?: string;
  @IsOptional() @IsString() service?: string;
  @IsOptional() @IsString() rateLimit?: string;
  @IsOptional() @IsString() @MaxLength(255) comment?: string;
  @IsOptional() @IsBoolean() disabled?: boolean;
}

export class DisconnectPppoeBody {
  @IsUUID() deviceId: string;
  /** RouterOS .id of the active session */
  @IsString() @IsNotEmpty() activeId: string;
}

// ── Phase D: Hotspot Profiles CRUD ────────────────────────────

export class CreateHotspotProfileBody {
  @IsUUID() deviceId: string;
  @IsString() @IsNotEmpty() @MaxLength(64) name: string;
  @IsOptional() @IsString() sessionTimeout?: string; // e.g. "1h", "30m"
  @IsOptional() @IsString() idleTimeout?: string;
  @IsOptional() @IsString() rateLimit?: string; // e.g. "5M/1M"
  @IsOptional() @IsInt() @Min(1) @Max(1000) sharedUsers?: number;
  @IsOptional() @IsString() @MaxLength(255) comment?: string;
}

export class UpdateHotspotProfileBody {
  @IsUUID() deviceId: string;
  @IsOptional() @IsString() @MaxLength(64) name?: string;
  @IsOptional() @IsString() sessionTimeout?: string;
  @IsOptional() @IsString() idleTimeout?: string;
  @IsOptional() @IsString() rateLimit?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) sharedUsers?: number;
  @IsOptional() @IsString() @MaxLength(255) comment?: string;
}

// ── Phase E: Professional Voucher Generator ───────────────────

export class GenerateProVouchersBody {
  @IsUUID() deviceId: string;
  @IsUUID() companyId: string;
  @IsString() @IsNotEmpty() @MaxLength(128) batchName: string;
  @IsString() @IsNotEmpty() profileName: string;
  /** 10 | 50 | 100 | 500 | any positive count (capped). */
  @IsInt() @Min(1) @Max(5000) count: number;
  @IsOptional() @IsString() @MaxLength(16) prefix?: string;
  @IsOptional() @IsString() @MaxLength(255) comment?: string;
  /** Use separate username/password instead of identical code. */
  @IsOptional() @IsBoolean() separateCredentials?: boolean;
  @IsOptional() @IsInt() @Min(3) @Max(32) usernameLength?: number;
  @IsOptional() @IsInt() @Min(3) @Max(32) passwordLength?: number;
  /** Validity window pushed to RouterOS as limit-uptime. e.g. "1d", "30d". */
  @IsOptional() @IsString() timeLimit?: string;
  /** Total data cap pushed as limit-bytes-total (in MB). */
  @IsOptional() @IsInt() @Min(1) dataLimitMb?: number;
  /** Optional explicit expiration date (ISO) stored in DB. */
  @IsOptional() @IsString() expiresAt?: string;
}
