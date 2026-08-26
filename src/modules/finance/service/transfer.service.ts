import { Injectable, Logger } from '@nestjs/common';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { CreateTransferDto } from '@finance/dto/transaction-record/create-transfer.dto';
import { UpdateTransferDto } from '@finance/dto/transaction-record/update-transfer.dto';
import {
  TransferMovementDto,
  TransferResponseDto,
} from '@finance/dto/transaction-record/transfer-response.dto';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly transactionRecordRepository: TransactionRecordRepository,
  ) {}

  async create(
    userId: number,
    dto: CreateTransferDto,
  ): Promise<TransferResponseDto> {
    const pair = await this.transactionRecordRepository.createTransfer(
      userId,
      dto,
    );
    return this.toResponseDto(pair);
  }

  async findAll(
    userId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: TransferResponseDto[]; total: number }> {
    const { data, total } =
      await this.transactionRecordRepository.findTransfers(userId, page, limit);
    const grouped = this.groupPairs(data);
    return {
      data: grouped.map((pair) => this.toResponseDto(pair)),
      total,
    };
  }

  async findOne(id: number, userId: number): Promise<TransferResponseDto> {
    const pair = await this.transactionRecordRepository.findTransferById(
      id,
      userId,
    );
    return this.toResponseDto(pair);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateTransferDto,
  ): Promise<TransferResponseDto> {
    const pair = await this.transactionRecordRepository.updateTransfer(
      id,
      userId,
      dto,
    );
    return this.toResponseDto(pair);
  }

  async remove(id: number, userId: number): Promise<void> {
    return this.transactionRecordRepository.softDeleteTransfer(id, userId);
  }

  /**
   * Como findTransfers devuelve ambos lados de cada par, agrupa por
   * transfer_group_id para devolver una transferencia por grupo.
   */
  private groupPairs(records: TransactionRecord[]): TransactionRecord[][] {
    const map = new Map<string, TransactionRecord[]>();
    for (const record of records) {
      const key = record.transfer_group_id ?? `record:${record.id}`;
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    }
    return Array.from(map.values());
  }

  private toResponseDto(pair: TransactionRecord[]): TransferResponseDto {
    const first = pair[0];
    const source = pair.find((r) => r.origin_account_id != null) ?? first;
    const destination =
      pair.find((r) => r.destination_account_id != null || r.liability_id != null) ?? first;

    return {
      transfer_group_id: first.transfer_group_id ?? '',
      amount: Number(first.amount ?? 0),
      transaction_date: first.transaction_date,
      description: first.description ?? null,
      reference_code: first.reference_code ?? null,
      objective_id: destination.objective_id ?? null,
      destination_liability_id: destination.liability_id ?? null,
      source: this.toMovementDto(source, 'source'),
      destination: this.toMovementDto(destination, 'destination'),
    };
  }

  private toMovementDto(
    record: TransactionRecord,
    side: 'source' | 'destination',
  ): TransferMovementDto {
    return {
      id: record.id,
      account_id:
        side === 'source'
          ? record.origin_account_id
          : record.destination_account_id,
      liability_id:
        side === 'destination' ? record.liability_id : null,
      side,
      bank_name:
        side === 'source'
          ? (record.source_bank ?? null)
          : (record.destination_bank ?? null),
      account_type:
        side === 'source'
          ? (record.source_account ?? null)
          : (record.destination_account ?? null),
      amount: Number(record.amount ?? 0),
      transaction_date: record.transaction_date,
      description: record.description ?? null,
      reference_code: record.reference_code ?? null,
      objective_id: record.objective_id ?? null,
      company_id: record.company_id ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }
}
