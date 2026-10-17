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
    return 'onchain';
  }
  if (rail === 'onchain') return 'onchain';
  return 'simulated';
}

function BuildConfigFromEnv(): AppConfig {
  const dashboardUrl = NormalizeOrigin(
    process.env.DASHBOARD_URL ||
    `http://localhost:${process.env.DASHBOARD_PORT || '80}`
  );
  const checkoutUrl = NormalizeOrigin(process.env.CHECKOUT_URL || dashboardUrl);
  const paymentLinkUrl = NormalizeOrigin(
    process.env.PAYMENT_LINK_URL || checkoutUrl
  );
  const livemode = process.env.LIVEMODE === 'true';

  return {
    mongodbUri:
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/zoneless?replicaSet=rs0',
    dashboardUrl,
    checkoutUrl,
    paymentLinkUrl,
    appSecret: process.env.APP_SECRET || '',
    livemode,
    settlement_rail: ResolveSettlementRail(livemode),
  };
}

export function IsSingleTenantMode(): boolean {
  if (IsOperatorMode()) {
    return false;
  }
  return process.env.SINGLE_TENANT !== 'false';
}
