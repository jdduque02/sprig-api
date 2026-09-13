import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ObjectivePayment } from '@finance/entities/objective-payment.entity';
import { FinancialObjective } from '@finance/entities/financial-objective.entity';
import { CreateObjectivePaymentDto } from '@finance/dto/objective-payment/create-objective-payment.dto';
import { applyCompletion } from '@shared/helpers/financial-objective.helper';

@Injectable()
export class ObjectivePaymentRepository {
  private readonly logger = new Logger(ObjectivePaymentRepository.name);

  constructor(
    @InjectRepository(ObjectivePayment)
    private readonly repo: Repository<ObjectivePayment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  /**
   * Registra un abono a una meta en una transacción atómica: valida que la
   * meta exista y pertenezca al usuario, guarda el pago, incrementa el saldo
   * actual de la meta y reevalúa su estado de completado.
   */
  async create(
    userId: number,
    dto: CreateObjectivePaymentDto,
  ): Promise<ObjectivePayment> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(ObjectivePayment);
      const objectiveRepo = manager.getRepository(FinancialObjective);

      const objective = await objectiveRepo.findOneBy({
        id: dto.objective_id,
        user_id: userId,
        deleted_at: IsNull(),
      });
      if (!objective)
        throw new NotFoundException(
          this.i18n.t('finance.OBJECTIVE_NOT_FOUND', {
            args: { id: dto.objective_id },
          }),
        );

      const payment = paymentRepo.create({ ...dto, user_id: userId });
      const saved = await paymentRepo.save(payment);

      objective.current_balance =
        Number(objective.current_balance ?? 0) + Number(dto.amount ?? 0);
      applyCompletion(objective);
      await objectiveRepo.save(objective);

      this.logger.log(
        `Pago al objetivo ${dto.objective_id} registrado para usuario ID: ${userId}`,
      );
      return saved;
    });
  }

  async findByObjective(
    objectiveId: number,
    userId: number,
  ): Promise<ObjectivePayment[]> {
    return this.repo.find({
      where: {
        objective_id: objectiveId,
        user_id: userId,
        deleted_at: IsNull(),
      },
      order: { payment_date: 'DESC' },
    });
  }

  async findById(id: number, userId: number): Promise<ObjectivePayment> {
    const payment = await this.repo.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
    if (!payment)
      throw new NotFoundException(
        this.i18n.t('finance.PAYMENT_NOT_FOUND', { args: { id } }),
      );
    return payment;
  }

  /**
   * Borrado lógico del abono; revierte su efecto sobre el saldo de la meta y
   * reevalúa el completado, todo en una transacción atómica.
   */
  async remove(id: number, userId: number): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(ObjectivePayment);
      const objectiveRepo = manager.getRepository(FinancialObjective);

      const payment = await paymentRepo.findOneBy({
        id,
        user_id: userId,
        deleted_at: IsNull(),
      });
      if (!payment)
        throw new NotFoundException(
          this.i18n.t('finance.PAYMENT_NOT_FOUND', { args: { id } }),
        );

      await paymentRepo.softRemove(payment);

      const objective = await objectiveRepo.findOneBy({
        id: payment.objective_id,
        deleted_at: IsNull(),
      });
      if (objective) {
        objective.current_balance =
          Number(objective.current_balance ?? 0) - Number(payment.amount ?? 0);
        applyCompletion(objective);
        await objectiveRepo.save(objective);
      }

      this.logger.log(`Pago ID ${id} eliminado para usuario ID: ${userId}`);
    });
  }
}
