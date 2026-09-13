import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private keys: Map<string, Buffer> = new Map();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const schemas = ['identity', 'finance', 'banking'];

    for (const schema of schemas) {
      const envKey = `ENC_${schema.toUpperCase()}_KEY`;
      const raw = this.configService.get<string>(envKey);

      if (!raw) {
        this.logger.warn(
          `${envKey} no está definido. La encriptación para el esquema '${schema}' no funcionará.`,
        );
        continue;
      }

      const keyBuffer = Buffer.from(raw, 'hex');

      if (keyBuffer.length !== KEY_LENGTH) {
        this.logger.error(
          `${envKey} debe tener exactamente ${KEY_LENGTH * 2} caracteres hex (${KEY_LENGTH} bytes). Longitud actual: ${raw.length} caracteres.`,
        );
        continue;
      }

      this.keys.set(schema, keyBuffer);
      this.logger.log(`Clave de encriptación cargada para esquema: ${schema}`);
    }
  }

  private getKey(schema: string): Buffer {
    const key = this.keys.get(schema);
    if (!key) {
      throw new Error(
        `No hay clave de encriptación configurada para el esquema '${schema}'. Verifica la variable de entorno ENC_${schema.toUpperCase()}_KEY.`,
      );
    }
    return key;
  }

  encrypt(plainText: string, schema: string): string {
    const key = this.getKey(schema);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: 16,
    });

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(cipherText: string, schema: string): string {
    const key = this.getKey(schema);
    const parts = cipherText.split(':');

    if (parts.length !== 3) {
      throw new Error(
        `Formato de texto cifrado inválido para esquema '${schema}'. Se esperaban 3 partes, se recibieron ${parts.length}.`,
      );
    }

    const [ivB64, authTagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: 16,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  encryptField(
    value: string | null | undefined,
    schema: string,
  ): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.encrypt(value, schema);
  }

  decryptField(
    value: string | null | undefined,
    schema: string,
  ): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    // Si no contiene ':' significa que no está encriptado (datos legacy o plano)
    if (!value.includes(':')) {
      return value;
    }
    try {
      return this.decrypt(value, schema);
    } catch {
      this.logger.warn(
        `No se pudo descifrar campo del esquema '${schema}'. Retornando valor original.`,
      );
      return value;
    }
  }

  isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    const parts = value.split(':');
    if (parts.length !== 3) return false;
    return parts.every((p) => /^[A-Za-z0-9+/=]+$/.test(p));
  }
}
