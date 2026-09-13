import { PartialType } from '@nestjs/swagger';
import { CreateFinancialAssetDto } from '@banking/dto/financial-asset/create-financial-asset.dto';

export class UpdateFinancialAssetDto extends PartialType(
  CreateFinancialAssetDto,
) {}
