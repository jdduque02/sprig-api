import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FinancialPeriodRepository } from '@finance/repositories/financial-period.repository';
import { CreateFinancialPeriodDto } from '@finance/dto/financial-period/create-financial-period.dto';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { todayInTimeZone } from '@shared/helpers/financial-objective.helper';

@Injectable()
export class FinancialPeriodService {
  private readonly logger = new Logger(FinancialPeriodService.name);

  constructor(
    private readonly financialPeriodRepository: FinancialPeriodRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async create(userId: number, dto: CreateFinancialPeriodDto) {
    return this.financialPeriodRepository.create(userId, dto);
  }

  async findAll(userId: number) {
    return this.financialPeriodRepository.findAll(userId);
  }

  async findOne(id: number, userId: number) {
    return this.financialPeriodRepository.findById(id, userId);
  }

  async close(id: number, userId: number) {
    return this.financialPeriodRepository.close(id, userId);
  }

  /**
   * Resuelve (o crea) el período financiero del mes actual del usuario,
   * en su zona horaria. Usado como período por defecto cuando no se
   * especifica uno explícito (ej. análisis de IA on-demand).
   */
  async findOrCreateCurrent(userId: number) {
    let timezone = 'America/Bogota';
    try {
      const user = await this.userRepository.findById(String(userId));
      timezone = user.timezone || 'America/Bogota';
    } catch (error) {
      // Solo "usuario no encontrado" recurre al default; un error de
      // infraestructura (DB caída, etc.) no debe pasar desapercibido.
      if (!(error instanceof NotFoundException)) throw error;
      this.logger.debug(
        `Usuario ${userId} no encontrado; se usa zona horaria por defecto.`,
      );
    }
    const today = todayInTimeZone(timezone);
    const [year, month] = today.split('-').map(Number);
    return this.financialPeriodRepository.findOrCreateCurrent(
      userId,
      year,
      month,
    );
  }
}
