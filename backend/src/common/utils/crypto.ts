import * as crypto from 'crypto';

// Master encryption key (fallback to 32 bytes derived from environment or random for safety)
const rawKey = process.env.ENCRYPTION_MASTER_KEY || 'e839f99e4f57c2a939f4039bca3bda4959cfc82dae11a221fbc34d580f1249fa';
const MASTER_KEY = Buffer.from(rawKey, 'hex');

/**
 * Encrypts a plaintext string (e.g., commercial FOB price, confidential notes)
 * using authenticated AES-256-GCM.
 * Format: `iv_hex:authTag_hex:ciphertext_hex`
 */
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an authenticated AES-256-GCM encrypted string.
 */
export function decryptField(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Computes a deterministic SHA-256 hash for secure token storage (e.g., BuyerMagicLink).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates an immutable audit integrity hash linking previous event to new event.
 */
export function calculateAuditHash(
  previousHash: string | null,
  entityId: string,
  action: string,
  reasonCode: string,
  timestamp: string,
  financialImpact: number | null
): string {
  const payload = `${previousHash || 'ROOT'}|${entityId}|${action}|${reasonCode}|${timestamp}|${financialImpact || 0}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
