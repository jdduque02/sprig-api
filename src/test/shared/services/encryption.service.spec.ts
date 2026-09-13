import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '@shared/services/encryption.service';

const VALID_HEX_KEY = 'a'.repeat(64);

describe('EncryptionService', () => {
  let service: EncryptionService;
  const configMock = {
    get: jest.fn((key: string) =>
      key === 'ENC_IDENTITY_KEY' ? VALID_HEX_KEY : undefined,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configMock.get.mockImplementation((key: string) =>
      key === 'ENC_IDENTITY_KEY' ? VALID_HEX_KEY : undefined,
    );
    service = new EncryptionService(configMock as unknown as ConfigService);
  });

  describe('onModuleInit', () => {
    it('carga las claves configuradas', () => {
      service.onModuleInit();
      expect(configMock.get).toHaveBeenCalledWith('ENC_IDENTITY_KEY');
    });

    it('advierte cuando no hay clave para un esquema', () => {
      configMock.get.mockReturnValue(undefined);
      service.onModuleInit();
      expect(configMock.get).toHaveBeenCalled();
    });

    it('descarta claves con longitud inválida', () => {
      configMock.get.mockReturnValue('short');
      service.onModuleInit();
      expect(configMock.get).toHaveBeenCalled();
    });
  });

  describe('encrypt / decrypt', () => {
    it('cifra y descifra correctamente', () => {
      service.onModuleInit();
      const cipher = service.encrypt('hola mundo', 'identity');
      expect(cipher).not.toContain('hola');
      expect(cipher.split(':')).toHaveLength(3);
      expect(service.decrypt(cipher, 'identity')).toBe('hola mundo');
    });

    it('genera cifrados distintos para el mismo texto (IV aleatorio)', () => {
      service.onModuleInit();
      const a = service.encrypt('mismo', 'identity');
      const b = service.encrypt('mismo', 'identity');
      expect(a).not.toBe(b);
    });

    it('lanza error si el esquema no tiene clave', () => {
      service.onModuleInit();
      expect(() => service.encrypt('x', 'unknown')).toThrow(/no hay clave/i);
    });

    it('lanza error si el formato cifrado es inválido', () => {
      service.onModuleInit();
      expect(() => service.decrypt('formato-mal', 'identity')).toThrow(
        /formato de texto cifrado/i,
      );
    });
  });

  describe('encryptField / decryptField', () => {
    it('devuelve null para valores vacíos', () => {
      expect(service.encryptField(null, 'identity')).toBeNull();
      expect(service.encryptField(undefined, 'identity')).toBeNull();
      expect(service.encryptField('', 'identity')).toBeNull();
      expect(service.decryptField(null, 'identity')).toBeNull();
      expect(service.decryptField('', 'identity')).toBeNull();
    });

    it('devuelve el valor plano si no contiene ":" (legacy)', () => {
      expect(service.decryptField('valor-plano', 'identity')).toBe(
        'valor-plano',
      );
    });

    it('cifra y descifra valores reales', () => {
      service.onModuleInit();
      const enc = service.encryptField('+573001234567', 'identity');
      expect(service.decryptField(enc, 'identity')).toBe('+573001234567');
    });

    it('retorna el valor original si no se puede descifrar', () => {
      service.onModuleInit();
      const bad = `${Buffer.from('123456789012').toString('base64')}:aG9sYQ==:YQ==`;
      expect(service.decryptField(bad, 'identity')).toBe(bad);
    });
  });

  describe('isEncrypted', () => {
    it('distingue valores cifrados', () => {
      service.onModuleInit();
      expect(service.isEncrypted('plano')).toBe(false);
      expect(service.isEncrypted('')).toBe(false);
      expect(service.isEncrypted(null)).toBe(false);
      expect(service.isEncrypted(service.encrypt('x', 'identity'))).toBe(true);
    });
  });
});
