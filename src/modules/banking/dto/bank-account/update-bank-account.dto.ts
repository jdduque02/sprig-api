import { PartialType } from '@nestjs/swagger';
import { CreateBankAccountDto } from '@banking/dto/bank-account/create-bank-account.dto';

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}
