import { Test, TestingModule } from '@nestjs/testing';
import { EmpresaService } from '@finance/service/empresa.service';
import { EmpresaRepository } from '@finance/repositories/empresa.repository';

describe('EmpresaService', () => {
  let service: EmpresaService;

  const mockEmpresaRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmpresaService,
        { provide: EmpresaRepository, useValue: mockEmpresaRepository },
      ],
    }).compile();

    service = module.get<EmpresaService>(EmpresaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('delega a empresaRepository.create', async () => {
      const dto = { name: 'Mi Empresa' };
      mockEmpresaRepository.create.mockResolvedValue({ id: 1, ...dto });
      const result = await service.create(10, dto);
      expect(mockEmpresaRepository.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('findAll', () => {
    it('delega a empresaRepository.findAll', async () => {
      const empresas = [{ id: 1, name: 'E1' }];
      mockEmpresaRepository.findAll.mockResolvedValue(empresas);
      const result = await service.findAll(10);
      expect(mockEmpresaRepository.findAll).toHaveBeenCalledWith(10);
      expect(result).toEqual(empresas);
    });
  });

  describe('findOne', () => {
    it('delega a empresaRepository.findById', async () => {
      mockEmpresaRepository.findById.mockResolvedValue({ id: 1, name: 'E1' });
      const result = await service.findOne(1, 10);
      expect(mockEmpresaRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual({ id: 1, name: 'E1' });
    });
  });

  describe('update', () => {
    it('delega a empresaRepository.update', async () => {
      const dto = { name: 'Updated' };
      mockEmpresaRepository.update.mockResolvedValue({ id: 1, ...dto });
      const result = await service.update(1, 10, dto);
      expect(mockEmpresaRepository.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('remove', () => {
    it('delega a empresaRepository.softDelete', async () => {
      mockEmpresaRepository.softDelete.mockResolvedValue(undefined);
      await service.remove(1, 10);
      expect(mockEmpresaRepository.softDelete).toHaveBeenCalledWith(1, 10);
    });
  });
});
