import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { OwnershipGuard } from '@auth/guards/ownership.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { FinancialProfileService } from '@identity/service/financial-profile.service';
import { CreateFinancialProfileDto } from '@identity/dto/financial-profile/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from '@identity/dto/financial-profile/update-financial-profile.dto';
import { FinancialProfileResponseDto } from '@identity/dto/financial-profile/financial-profile-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('identity')
@UseGuards(AuthGuard, OwnershipGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('user/:userId/financial-profile')
export class FinancialProfileController {
  constructor(
    private readonly financialProfileService: FinancialProfileService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear perfil financiero del usuario' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Perfil financiero creado.',
    type: FinancialProfileResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'El usuario ya tiene un perfil financiero.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear el perfil.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('userId') userId: string,
    @Body() createFinancialProfileDto: CreateFinancialProfileDto,
  ) {
    return this.financialProfileService.create(
      userId,
      createFinancialProfileDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Obtener perfil financiero del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Perfil financiero encontrado.',
    type: FinancialProfileResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El usuario no tiene perfil financiero.',
    type: ErrorResponseDto,
  })
  async findOne(@Param('userId') userId: string) {
    return this.financialProfileService.findByUserId(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar perfil financiero del usuario' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Perfil financiero actualizado.',
    type: FinancialProfileResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El usuario no tiene perfil financiero.',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('userId') userId: string,
    @Body() updateFinancialProfileDto: UpdateFinancialProfileDto,
  ) {
    return this.financialProfileService.update(
      userId,
      updateFinancialProfileDto,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar perfil financiero del usuario' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Perfil financiero eliminado.',
  })
  @ApiNotFoundResponse({
    description: 'El usuario no tiene perfil financiero.',
    type: ErrorResponseDto,
  })
  async remove(@Param('userId') userId: string) {
    await this.financialProfileService.remove(userId);
  }
}
