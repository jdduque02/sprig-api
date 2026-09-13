import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  ApiQuery,
  getSchemaPath,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@identity/service/user.service';
import { CreateUserDto } from '@identity/dto/user/create-user.dto';
import { UpdateUserDto } from '@identity/dto/user/update-user.dto';
import { UserQueryDto } from '@identity/dto/user/user-query.dto';
import { UserResponseDto } from '@identity/dto/user/user-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';

@ApiTags('identity')
@ApiExtraModels(UserResponseDto)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Usuario creado exitosamente.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear usuario en Keycloak o BD.',
    type: ErrorResponseDto,
  })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get('public/status')
  @ApiOperation({ summary: 'Estado del módulo de identidad' })
  getPublicStatus() {
    return { status: 'Identity Module is Running', authentication: 'Bypassed' };
  }

  @Get()
  @UseGuards(AuthGuard, AdminGuard)
  @ApiIntrospectGuardResponse()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar usuarios paginados (admin)' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Número de página (desde 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: 'Resultados por página (máx. 100)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de usuarios.',
    schema: {
      properties: {
        status: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Operación exitosa' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(UserResponseDto) },
        },
        total: { type: 'number', example: 42 },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token inválido o ausente.',
    type: ErrorResponseDto,
  })
  async findAll(@Query() query: UserQueryDto) {
    return this.userService.findAllUsers(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard, OwnershipGuard)
  @ApiIntrospectGuardResponse()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuario encontrado.',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado.',
    type: ErrorResponseDto,
  })
  async getUser(@Param('id') id: string) {
    return this.userService.findUser(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, OwnershipGuard)
  @ApiIntrospectGuardResponse()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Actualizar información del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuario actualizado exitosamente.',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Usuario no encontrado.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al actualizar el usuario.',
    type: ErrorResponseDto,
  })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, updateUserDto);
  }
}
