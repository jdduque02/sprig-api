import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EmpresaRepository } from '@finance/repositories/empresa.repository';
import { Empresa } from '@finance/entities/empresa.entity';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
};

const mockI18n = { t: jest.fn((key: string) => key) };

const buildEmpresa = (overrides: Partial<Empresa> = {}): Empresa =>
  ({
    id: 1,
    user_id: 10,
    name: 'Mi Empresa',
    default_category_id: null,
    deleted_at: null,
    ...overrides,
  }) as Empresa;

describe('EmpresaRepository', () => {
  let repo: EmpresaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EmpresaRepository(
      mockRepo as never,
      mockI18n as unknown as I18nService,
    );
  });

  describe('create', () => {
    it('crea una empresa con default_category_id explícito', async () => {
      const entity = buildEmpresa({ default_category_id: 3 });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await repo.create(10, {
        name: 'Mi Empresa',
        default_category_id: 3,
      });

      expect(mockRepo.create).toHaveBeenCalledWith({
        user_id: 10,
        name: 'Mi Empresa',
        default_category_id: 3,
      });
      expect(result).toEqual(entity);
    });

    it('usa null como default_category_id si no se provee', async () => {
      const entity = buildEmpresa();
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      await repo.create(10, { name: 'Mi Empresa' });

      expect(mockRepo.create).toHaveBeenCalledWith({
        user_id: 10,
        name: 'Mi Empresa',
        default_category_id: null,
      });
    });
  });

  describe('findAll', () => {
    it('retorna las empresas activas del usuario ordenadas por nombre', async () => {
      const empresas = [buildEmpresa()];
      mockRepo.find.mockResolvedValue(empresas);

      const result = await repo.findAll(10);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { name: 'ASC' } }),
      );
      expect(result).toEqual(empresas);
    });
  });

  describe('findById', () => {
    it('retorna la empresa si existe', async () => {
      const entity = buildEmpresa();
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(entity);
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('actualiza y retorna la empresa', async () => {
      const entity = buildEmpresa();
      const merged = buildEmpresa({ name: 'Actualizada' });
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.merge.mockReturnValue(merged);
      mockRepo.save.mockResolvedValue(merged);

      const result = await repo.update(1, 10, { name: 'Actualizada' });

      expect(mockRepo.merge).toHaveBeenCalledWith(entity, {
        name: 'Actualizada',
      });
      expect(result).toEqual(merged);
    });

    it('propaga NotFoundException si la empresa no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(repo.update(999, 10, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('elimina (soft) la empresa existente', async () => {
      const entity = buildEmpresa();
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.softRemove.mockResolvedValue(entity);

      await repo.softDelete(1, 10);

      expect(mockRepo.softRemove).toHaveBeenCalledWith(entity);
    });

    it('propaga NotFoundException si la empresa no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(repo.softDelete(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByName', () => {
    it('busca una empresa activa por nombre exacto', async () => {
      const entity = buildEmpresa();
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findByName(10, 'Mi Empresa');

      const [callArg] = mockRepo.findOne.mock.calls[0] as [
        { where: { user_id: number; name: string } },
      ];
      expect(callArg.where.user_id).toBe(10);
      expect(callArg.where.name).toBe('Mi Empresa');
      expect(result).toEqual(entity);
    });

    it('retorna null si no encuentra coincidencia', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await repo.findByName(10, 'Inexistente');

      expect(result).toBeNull();
    });
  });

  describe('findByFuzzyName', () => {
    it('retorna null si el término normalizado está vacío', async () => {
      const result = await repo.findByFuzzyName(10, '   ');

      expect(result).toBeNull();
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it('encuentra por coincidencia: término incluido en el nombre de la empresa', async () => {
      mockRepo.find.mockResolvedValue([
        buildEmpresa({ id: 1, name: 'Panadería El Trigo' }),
        buildEmpresa({ id: 2, name: 'Supermercado XYZ' }),
      ]);

      const result = await repo.findByFuzzyName(10, 'trigo');

      expect(result?.id).toBe(1);
    });

    it('encuentra por coincidencia: nombre de empresa incluido en el término', async () => {
      mockRepo.find.mockResolvedValue([
        buildEmpresa({ id: 3, name: 'Ecopetrol' }),
      ]);

      const result = await repo.findByFuzzyName(
        10,
        'compra en ecopetrol estacion',
      );

      expect(result?.id).toBe(3);
    });

    it('retorna null si no hay ninguna coincidencia', async () => {
      mockRepo.find.mockResolvedValue([
        buildEmpresa({ id: 1, name: 'Panadería El Trigo' }),
      ]);

      const result = await repo.findByFuzzyName(10, 'gasolina');

      expect(result).toBeNull();
    });
  });
});
