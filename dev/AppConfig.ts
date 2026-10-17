import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type {
  AppConfig,
  AppSecrets,
  SettlementRail,
} from '@'

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Re-export for convenience
export type { AppConfig, AppSecrets };

// Singleton config instance
let config: AppConfig | null = null;

let cachedJwtSecret: string | null = null;
let cachedEncryptionKey: string | null = null;

const SECRETS_COLLECTION = 'AppSecrets';
const SECRETS_ID = 'app_secrets';

const HDKF_JWT_INFO = 'jwt-singing-key';
const HKDF_ENCRYPTION_INFO = 'encryption-key';

function GenerateSecureHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function NormalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

function ResolveSettlementRail(livemode: boolean): SettlementRail {
  const rail = (process.env.SETTLEMENT_RAIL || '').trim().toLowerCase();
  if (livemode) {
    if (rail === 'simulated') {
      throw new Error(
        'SETTLEMENT_RAIL=simulated is not valid when LIVEMODE=true'
      );
    }
