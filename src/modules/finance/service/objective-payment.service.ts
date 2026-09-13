import { Injectable, Logger } from '@nestjs/common';
import { ObjectivePaymentRepository } from '@finance/repositories/objective-payment.repository';
import { CreateObjectivePaymentDto } from '@finance/dto/objective-payment/create-objective-payment.dto';

@Injectable()
export class ObjectivePaymentService {
  private readonly logger = new Logger(ObjectivePaymentService.name);

  constructor(
    private readonly objectivePaymentRepository: ObjectivePaymentRepository,
  ) {}

  async create(userId: number, dto: CreateObjectivePaymentDto) {
    return this.objectivePaymentRepository.create(userId, dto);
  }

  async findByObjective(objectiveId: number, userId: number) {
    return this.objectivePaymentRepository.findByObjective(objectiveId, userId);
  }

  async findOne(id: number, userId: number) {
    return this.objectivePaymentRepository.findById(id, userId);
  }

  async remove(id: number, userId: number) {
    return this.objectivePaymentRepository.remove(id, userId);
  }
}
