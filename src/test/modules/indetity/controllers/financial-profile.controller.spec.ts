import { NotFoundException } from '@nestjs/common';
import { FinancialProfileController } from '@identity/controller/financial-profile.controller';
import { FinancialProfileService } from '@identity/service/financial-profile.service';
import { CreateFinancialProfileDto } from '@identity/dto/financial-profile/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from '@identity/dto/financial-profile/update-financial-profile.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockFinancialProfileService = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockUserService = {
  assertOwnership: jest.fn().mockResolvedValue(undefined),
};

const currentUser = { sub: 'kc-uuid' } as unknown as IntrospectResponse;

describe('FinancialProfileController', () => {
  let controller: FinancialProfileController;

  beforeEach(() => {
    controller = new FinancialProfileController(
      mockFinancialProfileService as unknown as FinancialProfileService,
      mockUserService,
    );
    jest.clearAllMocks();
  });

  it('debe crear perfil financiero delegando al servicio', async () => {
    const dto: CreateFinancialProfileDto = {
      user_id: 99,
      profile_name: 'Plan de Ahorro',
      is_custom: false,
      needs_ratio: 50,
      wants_ratio: 30,
      savings_ratio: 20,
      max_debt_ratio: 35,
    };
    const created = { id: 1, user_id: 2, ...dto };
    mockFinancialProfileService.create.mockResolvedValue(created);

    const result = await controller.create('2', dto, currentUser);
    expect(mockFinancialProfileService.create).toHaveBeenCalledWith('2', dto);
    expect(result).toEqual(created);
  });

  it('debe obtener perfil financiero por userId', async () => {
    const profile = { id: 1, user_id: 2, profile_name: 'Plan Base' };
    mockFinancialProfileService.findByUserId.mockResolvedValue(profile);

    const result = await controller.findOne('2', currentUser);
    expect(mockFinancialProfileService.findByUserId).toHaveBeenCalledWith('2');
    expect(result).toEqual(profile);
  });

  it('debe actualizar perfil financiero por userId', async () => {
    const dto: UpdateFinancialProfileDto = { needs_ratio: 60 };
    const updated = { id: 1, user_id: 2, needs_ratio: 60 };
    mockFinancialProfileService.update.mockResolvedValue(updated);

    const result = await controller.update('2', dto, currentUser);
    expect(mockFinancialProfileService.update).toHaveBeenCalledWith('2', dto);
    expect(result).toEqual(updated);
  });

  it('debe eliminar perfil financiero y retornar undefined', async () => {
    mockFinancialProfileService.remove.mockResolvedValue(undefined);

    const result = await controller.remove('2', currentUser);
    expect(mockFinancialProfileService.remove).toHaveBeenCalledWith('2');
    expect(result).toBeUndefined();
  });

  it('debe propagar excepción del servicio', async () => {
    mockFinancialProfileService.findByUserId.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(controller.findOne('999', currentUser)).rejects.toThrow(
      NotFoundException,
    );
  });
});
