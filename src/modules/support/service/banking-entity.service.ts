import { Injectable } from '@nestjs/common';
import { BankingEntityRepository } from '@support/repositories/banking-entity.repository';
import { BankingEntity } from '@support/entities/banking-entity.entity';
import { CreateBankingEntityDto } from '@support/dto/banking-entity/create-banking-entity.dto';
import { UpdateBankingEntityDto } from '@support/dto/banking-entity/update-banking-entity.dto';
import { BankingEntityDetection } from '@finance/service/bank-statement-parser';

@Injectable()
export class BankingEntityService {
  constructor(
    private readonly bankingEntityRepository: BankingEntityRepository,
  ) {}

  create(dto: CreateBankingEntityDto): Promise<BankingEntity> {
    return this.bankingEntityRepository.create(dto);
  }

  findAll(): Promise<BankingEntity[]> {
    return this.bankingEntityRepository.findAll();
  }

  findOne(id: number): Promise<BankingEntity> {
    return this.bankingEntityRepository.findById(id);
  }

  update(id: number, dto: UpdateBankingEntityDto): Promise<BankingEntity> {
    return this.bankingEntityRepository.update(id, dto);
  }

  remove(id: number): Promise<void> {
    return this.bankingEntityRepository.softDelete(id);
  }

  /**
   * Entidades activas para la detección de extractos. La consume el
   * `StatementImportService` al parsear PDFs.
   */
  getActiveDetections(): Promise<BankingEntityDetection[]> {
    return this.bankingEntityRepository.findActiveDetections();
  }
}
