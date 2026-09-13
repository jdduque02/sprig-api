import { Injectable } from '@nestjs/common';
import { FinancialProfileRepository } from '@identity/repositories/financial-profile.repository';
import { CreateFinancialProfileDto } from '@identity/dto/financial-profile/create-financial-profile.dto';
import { UpdateFinancialProfileDto } from '@identity/dto/financial-profile/update-financial-profile.dto';

@Injectable()
export class FinancialProfileService {
  constructor(
    private readonly financialProfileRepository: FinancialProfileRepository,
  ) {}

  create(
    userId: string,
    createFinancialProfileDto: Omit<CreateFinancialProfileDto, 'user_id'>,
  ) {
    return this.financialProfileRepository.create(
      userId,
      createFinancialProfileDto,
    );
  }

  findByUserId(userId: string) {
    return this.financialProfileRepository.findByUserId(userId);
  }

  update(userId: string, updateFinancialProfileDto: UpdateFinancialProfileDto) {
    return this.financialProfileRepository.update(
      userId,
      updateFinancialProfileDto,
    );
  }

  remove(userId: string) {
    return this.financialProfileRepository.remove(userId);
  }
}
