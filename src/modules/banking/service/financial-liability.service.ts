import { Injectable, Logger } from '@nestjs/common';
import { FinancialLiabilityRepository } from '@banking/repositories/financial-liability.repository';
import { CreateFinancialLiabilityDto } from '@banking/dto/financial-liability/create-financial-liability.dto';
import { UpdateFinancialLiabilityDto } from '@banking/dto/financial-liability/update-financial-liability.dto';

@Injectable()
export class FinancialLiabilityService {
  private readonly logger = new Logger(FinancialLiabilityService.name);

  constructor(
    private readonly financialLiabilityRepository: FinancialLiabilityRepository,
  ) {}

  async create(userId: number, dto: CreateFinancialLiabilityDto) {
    return this.financialLiabilityRepository.create(userId, dto);
  }

  async findAll(userId: number) {
    return this.financialLiabilityRepository.findAll(userId);
  }

  async findOne(id: number, userId: number) {
    return this.financialLiabilityRepository.findById(id, userId);
  }

  async update(id: number, userId: number, dto: UpdateFinancialLiabilityDto) {
    return this.financialLiabilityRepository.update(id, userId, dto);
  }

  async remove(id: number, userId: number) {
    return this.financialLiabilityRepository.softDelete(id, userId);
  }
}
