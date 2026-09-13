import { NotFoundException } from '@nestjs/common';
import { UserController } from '@identity/controller/user.controller';
import { UserService } from '@identity/service/user.service';
import { CreateUserDto } from '@identity/dto/user/create-user.dto';
import { UpdateUserDto } from '@identity/dto/user/update-user.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockUserService = {
  createUser: jest.fn(),
  findAllUsers: jest.fn(),
  findUser: jest.fn(),
  updateUser: jest.fn(),
  assertOwnership: jest.fn().mockResolvedValue(undefined),
};

const currentUser = { sub: 'kc-uuid' } as unknown as IntrospectResponse;

describe('UserController', () => {
  let controller: UserController;

  beforeEach(() => {
    controller = new UserController(mockUserService as unknown as UserService);
    jest.clearAllMocks();
  });

  it('debe crear usuario delegando al servicio', async () => {
    const dto: CreateUserDto = {
      username: 'juan',
      email: 'juan@test.com',
      password: 'Pass123!@#',
    };
    const created = { id: 1, username: 'juan', email: 'juan@test.com' };
    mockUserService.createUser.mockResolvedValue(created);

    const result = await controller.createUser(dto);
    expect(mockUserService.createUser).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('debe listar usuarios delegando el query de paginación al servicio', async () => {
    const payload = { data: [], total: 0 };
    mockUserService.findAllUsers.mockResolvedValue(payload);

    const result = await controller.findAll({ page: 1, limit: 200 });
    expect(mockUserService.findAllUsers).toHaveBeenCalledWith({
      page: 1,
      limit: 200,
    });
    expect(result).toEqual(payload);
  });

  it('debe listar usuarios delegando el query con límite menor a 100', async () => {
    const payload = { data: [{ id: 1 }], total: 1 };
    mockUserService.findAllUsers.mockResolvedValue(payload);

    const result = await controller.findAll({ page: 2, limit: 20 });
    expect(mockUserService.findAllUsers).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
    });
    expect(result).toEqual(payload);
  });

  it('debe obtener usuario por id', async () => {
    const user = { id: 3, username: 'ana' };
    mockUserService.findUser.mockResolvedValue(user);

    const result = await controller.getUser('3', currentUser);
    expect(mockUserService.findUser).toHaveBeenCalledWith('3');
    expect(result).toEqual(user);
  });

  it('debe actualizar usuario por id', async () => {
    const dto: UpdateUserDto = { timezone: 'America/Bogota' };
    const updated = { id: 3, timezone: 'America/Bogota' };
    mockUserService.updateUser.mockResolvedValue(updated);

    const result = await controller.updateUser('3', dto, currentUser);
    expect(mockUserService.updateUser).toHaveBeenCalledWith('3', dto);
    expect(result).toEqual(updated);
  });

  it('debe propagar NotFoundException del servicio', async () => {
    mockUserService.findUser.mockRejectedValue(new NotFoundException());
    await expect(controller.getUser('999', currentUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('debe retornar estado público del módulo', () => {
    const result = controller.getPublicStatus();
    expect(result).toEqual({
      status: 'Identity Module is Running',
      authentication: 'Bypassed',
    });
  });
});
