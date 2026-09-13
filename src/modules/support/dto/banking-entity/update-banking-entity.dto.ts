import { PartialType } from '@nestjs/swagger';
import { CreateBankingEntityDto } from './create-banking-entity.dto';

export class UpdateBankingEntityDto extends PartialType(
  CreateBankingEntityDto,
) {}
