import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateFinancialProfileDto } from './create-financial-profile.dto';

/**
 * DTO para la actualización parcial de un perfil financiero.
 * Se omite user_id porque no debería cambiar en actualizaciones.
 */
export class UpdateFinancialProfileDto extends PartialType(
  OmitType(CreateFinancialProfileDto, ['user_id'] as const),
) {}
