import { SeedCliOptions } from './types';

export class SeedSafetyGuard {
  static assertSafeToExecute(options: SeedCliOptions): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const isStaging = process.env.NODE_ENV === 'staging';

    console.log(`[SafetyGuard] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SafetyGuard] Requested Profile: ${options.profile} | Clean Wipe: ${options.clean ? 'YES' : 'NO'}`);

    if (isProduction) {
      if (options.clean) {
        console.error('================================================================================');
        console.error('CRITICAL SAFETY VIOLATION: ATTEMPTED DESTRUCTIVE WIPE IN PRODUCTION ENVIRONMENT!');
        console.error('================================================================================');

        const expectedKey = process.env.PROD_SEED_CONFIRMATION_KEY;
        if (!expectedKey) {
          throw new Error(
            'ABORT: Destructive wipe in production is forbidden when PROD_SEED_CONFIRMATION_KEY is not configured in the host environment.'
          );
        }

        if (options.confirmationKey !== expectedKey) {
          throw new Error(
            'ABORT: Invalid confirmation key provided. Production database purge aborted to prevent irreversible data loss.'
          );
        }

        if (!options.forceDestructiveWipe) {
          throw new Error(
            'ABORT: Production wipe requires explicit flag --force-destructive-wipe alongside verified confirmation key.'
          );
        }

        console.warn('[SafetyGuard] WARNING: Verified two-tier override confirmation. Proceeding with audited production wipe.');
      } else {
        console.log('[SafetyGuard] Production run detected in additive/upsert mode. Safe non-destructive seeding enabled.');
      }
    } else if (isStaging && options.clean && !options.forceDestructiveWipe) {
      console.warn('[SafetyGuard] NOTICE: Running wipe on staging environment. Consider using idempotent upserting instead.');
    }
  }
}
