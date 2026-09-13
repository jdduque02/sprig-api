import { PartialType } from '@nestjs/swagger';
import { CreateFinancialLiabilityDto } from '@banking/dto/financial-liability/create-financial-liability.dto';

export class UpdateFinancialLiabilityDto extends PartialType(
  CreateFinancialLiabilityDto,
) {}
