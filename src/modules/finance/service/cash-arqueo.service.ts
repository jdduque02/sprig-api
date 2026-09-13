import { Injectable } from '@nestjs/common';
import { CashArqueoRepository } from '@finance/repositories/cash-arqueo.repository';
import { CreateCashArqueoDto } from '@finance/dto/cash-arqueo/create-cash-arqueo.dto';
import { CashReconciliationDto } from '@finance/dto/cash-arqueo/cash-arqueo-response.dto';

@Injectable()
export class CashArqueoService {
  constructor(private readonly cashArqueoRepository: CashArqueoRepository) {}

  async create(userId: number, dto: CreateCashArqueoDto) {
    const month = this.resolveMonth(dto.arqueo_date);
    const reconciliation = await this.cashArqueoRepository.getReconciliation(
      userId,
      month,
    );
    return this.cashArqueoRepository.create(userId, dto, reconciliation);
  }

  getReconciliation(
    userId: number,
    month: string,
  ): Promise<CashReconciliationDto> {
    return this.cashArqueoRepository.getReconciliation(userId, month);
  }

  findAll(userId: number) {
    return this.cashArqueoRepository.findAll(userId);
  }

  findOne(id: number, userId: number) {
    return this.cashArqueoRepository.findById(id, userId);
  }

  remove(id: number, userId: number) {
    return this.cashArqueoRepository.softDelete(id, userId);
  }

  private resolveMonth(arqueoDate?: string): string {
    const date = arqueoDate ?? new Date().toISOString().slice(0, 10);
    return date.slice(0, 7);
  }
}
