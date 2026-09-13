import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { MailService } from '../service/mail.service';
import {
  BroadcastEmailDto,
  BroadcastEmailResponseDto,
} from '../dto/broadcast-email.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('admin / emails')
@UseGuards(AuthGuard, AdminGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('admin/emails')
export class AdminMailController {
  constructor(private readonly mailService: MailService) {}

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Crear un correo (como noticia) y enviarlo a todos los usuarios activos (admin)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Correo enviado (o registrado en mock).',
    type: BroadcastEmailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Solo administradores.',
    type: ErrorResponseDto,
  })
  async broadcast(
    @Body() dto: BroadcastEmailDto,
  ): Promise<BroadcastEmailResponseDto> {
    return this.mailService.sendBroadcast(dto);
  }
}
