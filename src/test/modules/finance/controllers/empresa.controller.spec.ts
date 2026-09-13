import { Test, TestingModule } from '@nestjs/testing';
import { EmpresaController } from '@finance/controller/empresa.controller';
import { EmpresaService } from '@finance/service/empresa.service';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';

describe('EmpresaController', () => {
  let controller: EmpresaController;

  const mockEmpresaService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpresaController],
      providers: [{ provide: EmpresaService, useValue: mockEmpresaService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OwnershipGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EmpresaController>(EmpresaController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delega a empresaService.create', async () => {
      const dto = { name: 'Test Empresa' };
      mockEmpresaService.create.mockResolvedValue({ id: 1, ...dto });
      const result = await controller.create(10, dto, {} as any);
      expect(mockEmpresaService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('findAll', () => {
    it('delega a empresaService.findAll', async () => {
      const empresas = [{ id: 1, name: 'E1' }];
      mockEmpresaService.findAll.mockResolvedValue(empresas);
      const result = await controller.findAll(10, {} as any);
      expect(mockEmpresaService.findAll).toHaveBeenCalledWith(10);
      expect(result).toEqual(empresas);
    });
  });

  describe('findOne', () => {
    it('delega a empresaService.findOne', async () => {
      mockEmpresaService.findOne.mockResolvedValue({ id: 1, name: 'E1' });
      const result = await controller.findOne(10, 1, {} as any);
      expect(mockEmpresaService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual({ id: 1, name: 'E1' });
    });
  });

  describe('update', () => {
    it('delega a empresaService.update', async () => {
      const dto = { name: 'Updated' };
      mockEmpresaService.update.mockResolvedValue({ id: 1, ...dto });
      const result = await controller.update(10, 1, dto, {} as any);
      expect(mockEmpresaService.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual({ id: 1, ...dto });
    });
  });

  describe('remove', () => {
    it('delega a empresaService.remove', async () => {
      mockEmpresaService.remove.mockResolvedValue(undefined);
      const result = await controller.remove(10, 1, {} as any);
      expect(mockEmpresaService.remove).toHaveBeenCalledWith(1, 10);
      expect(result).toBeUndefined();
    });
  });
});
