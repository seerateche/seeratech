// ============================================================
// SIRA PLATFORM v4 - Security Service (AES-256-GCM)
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface DeviceCredentials {
  username: string;
  password: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly masterKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyHex = config.get<string>('ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      const msg =
        'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: openssl rand -hex 32';
      this.logger.error(msg);
      throw new Error(msg);
    }
    this.masterKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   * Returns IV, ciphertext, and authentication tag as hex strings.
   */
  encrypt(plaintext: string): EncryptedPayload {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv, {
      authTagLength: this.tagLength,
    });

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Decrypts an AES-256-GCM encrypted payload.
   * Throws if authentication tag validation fails (tamper detection).
   */
  decrypt(payload: EncryptedPayload): string {
    const iv = Buffer.from(payload.iv, 'hex');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv, {
      authTagLength: this.tagLength,
    });
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  /**
   * Encrypts device credentials (username + password) for storage.
   * Uses a single IV/tag pair for both fields to reduce DB columns.
   */
  encryptCredentials(username: string, password: string): {
    encryptedUsername: string;
    encryptedPassword: string;
    iv: string;
    tag: string;
  } {
    const usernamePayload = this.encrypt(username);
    const passwordPayload = this.encrypt(password);

    // Return as a composite - each has its own IV for maximum security
    return {
      encryptedUsername: `${usernamePayload.iv}:${usernamePayload.ciphertext}`,
      encryptedPassword: `${passwordPayload.iv}:${passwordPayload.ciphertext}`,
      iv: usernamePayload.iv,
      tag: `${usernamePayload.tag}:${passwordPayload.tag}`,
    };
  }

  /**
   * Decrypts stored device credentials.
   * Returns plaintext username and password in-memory only.
   */
  decryptCredentials(
    encryptedUsername: string,
    encryptedPassword: string,
    iv: string,
    tag: string,
  ): DeviceCredentials {
    const [usernameIv, usernameCiphertext] = encryptedUsername.split(':');
    const [passwordIv, passwordCiphertext] = encryptedPassword.split(':');
    const [usernameTag, passwordTag] = tag.split(':');

    const username = this.decrypt({
      ciphertext: usernameCiphertext,
      iv: usernameIv,
      tag: usernameTag,
    });

    const password = this.decrypt({
      ciphertext: passwordCiphertext,
      iv: passwordIv,
      tag: passwordTag,
    });

    return { username, password };
  }

  /**
   * Generates a cryptographically secure random token.
   */
  generateSecureToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generates a WireGuard-compatible private key (32 random bytes, base64).
   */
  generateWireGuardKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Hashes a password using bcrypt-like PBKDF2.
   * Used for additional non-user-auth hashing needs.
   */
  async hashData(data: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(data, s, 310000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
    return { hash, salt: s };
  }

  /**
   * Constant-time comparison to prevent timing attacks.
   */
  safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
