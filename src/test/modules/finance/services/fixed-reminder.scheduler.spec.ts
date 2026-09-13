import {
  FixedReminderScheduler,
  nextMonthlyOccurrence,
  nextBiweeklyOccurrence,
  nextWeeklyOccurrence,
  nextQuarterlyOccurrence,
  nextYearlyOccurrence,
  nextOccurrence,
  daysInMonth,
  startOfDay,
} from '@finance/service/fixed-reminder.scheduler';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { NotificationService } from '@notification/service/notification.service';
import { I18nService } from 'nestjs-i18n';
import { Logger } from '@nestjs/common';
import {
  FixedTypeEnum,
  FrequencyEnum,
  TransactionTypeEnum,
} from '@shared/enums';

const mockTransactionRepo = {
  findFixedForReminders: jest.fn(),
};

const mockNotificationService = {
  createIfMissing: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildTx = (
  overrides: Partial<TransactionRecord> = {},
): TransactionRecord =>
  ({
    id: 1,
    user_id: 10,
    type: 'expense',
    amount: '50000',
    is_fixed: true,
    frequency: 'monthly',
    due_day: 15,
    reminder_days: 3,
    description: 'Suscripción Movistar',
    created_at: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides,
  }) as unknown as TransactionRecord;

describe('FixedReminderScheduler', () => {
  let scheduler: FixedReminderScheduler;

  beforeEach(() => {
    scheduler = new FixedReminderScheduler(
      mockTransactionRepo as unknown as TransactionRecordRepository,
      mockNotificationService as unknown as NotificationService,
      mockI18nService as unknown as I18nService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // nextMonthlyOccurrence
  // ─────────────────────────────────────────────────────────────
  describe('nextMonthlyOccurrence', () => {
    it('debe devolver el due_day del mes actual si aún no pasó', () => {
      const today = new Date(2026, 7, 2, 10);
      const result = nextMonthlyOccurrence(15, today);
      expect(result).toEqual(new Date(2026, 7, 15));
    });

    it('debe pasar al mes siguiente si el due_day ya pasó', () => {
      const today = new Date(2026, 7, 20, 10);
      const result = nextMonthlyOccurrence(15, today);
      expect(result).toEqual(new Date(2026, 8, 15));
    });

    it('debe hacer clamp al último día del mes', () => {
      const today = new Date(2026, 1, 2, 10);
      const result = nextMonthlyOccurrence(31, today);
      expect(result).toEqual(new Date(2026, 1, 28));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // nextBiweeklyOccurrence
  // ─────────────────────────────────────────────────────────────
  describe('nextBiweeklyOccurrence', () => {
    it('debe devolver hoy si hoy es una ocurrencia (ancla)', () => {
      const today = new Date(2026, 7, 15, 10);
      const result = nextBiweeklyOccurrence(15, new Date(2026, 7, 1), today);
      expect(result).toEqual(startOfDay(today));
    });

    it('debe calcular la próxima ocurrencia cada 14 días', () => {
      const today = new Date(2026, 7, 20, 10);
      const result = nextBiweeklyOccurrence(15, new Date(2026, 7, 1), today);
      expect(result).toEqual(new Date(2026, 7, 29));
    });

    it('debe usar la fecha de creación como ancla si no hay due_day', () => {
      const today = new Date(2026, 7, 10, 10);
      const result = nextBiweeklyOccurrence(null, new Date(2026, 7, 1), today);
      expect(result).toEqual(new Date(2026, 7, 15));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // nextWeeklyOccurrence
  // ─────────────────────────────────────────────────────────────
  describe('nextWeeklyOccurrence', () => {
    it('debe devolver hoy si hoy cae en el ancla semanal', () => {
      const today = new Date(2026, 7, 15, 10);
      const result = nextWeeklyOccurrence(new Date(2026, 7, 15, 8), today);
      expect(result).toEqual(startOfDay(today));
    });

    it('debe calcular la próxima ocurrencia semanal', () => {
      const today = new Date(2026, 7, 13, 10);
      const result = nextWeeklyOccurrence(new Date(2026, 7, 1), today);
      expect(result).toEqual(new Date(2026, 7, 15));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // nextQuarterlyOccurrence
  // ─────────────────────────────────────────────────────────────
  describe('nextQuarterlyOccurrence', () => {
    it('debe retornar el due_day del trimestre si aún no pasó', () => {
      const result = nextQuarterlyOccurrence(
        15,
        new Date(2026, 7, 1),
        new Date(2026, 7, 10, 10),
      );
      expect(result).toEqual(new Date(2026, 7, 15));
    });

    it('debe avanzar por trimestres hasta superar hoy', () => {
      const result = nextQuarterlyOccurrence(
        15,
        new Date(2026, 0, 15),
        new Date(2026, 7, 1, 10),
      );
      expect(result).toEqual(new Date(2026, 9, 15));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // nextYearlyOccurrence
  // ─────────────────────────────────────────────────────────────
  describe('nextYearlyOccurrence', () => {
    it('debe retornar el due_day del año si aún no pasó', () => {
      const result = nextYearlyOccurrence(
        20,
        new Date(2026, 7, 1),
        new Date(2026, 7, 10, 10),
      );
      expect(result).toEqual(new Date(2026, 7, 20));
    });

    it('debe avanzar por años hasta superar hoy', () => {
      const result = nextYearlyOccurrence(
        15,
        new Date(2024, 7, 1),
        new Date(2026, 7, 10, 10),
      );
      expect(result).toEqual(new Date(2026, 7, 15));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // nextOccurrence
  // ─────────────────────────────────────────────────────────────
  describe('nextOccurrence', () => {
    const today = new Date(2026, 7, 10, 10);

    it('debe devolver hoy para frecuencia diaria', () => {
      const result = nextOccurrence(
        { frequency: FrequencyEnum.DAILY, due_day: 15, created_at: today },
        today,
      );
      expect(result).toEqual(startOfDay(today));
    });

    it('debe devolver null sin due_day', () => {
      const result = nextOccurrence(
        { frequency: FrequencyEnum.MONTHLY, due_day: null, created_at: today },
        today,
      );
      expect(result).toBeNull();
    });

    it('debe delegar según la frecuencia', () => {
      const weekly = nextOccurrence(
        {
          frequency: FrequencyEnum.WEEKLY,
          due_day: 15,
          created_at: new Date(2026, 7, 1),
        },
        today,
      );
      expect(weekly).toEqual(new Date(2026, 7, 15));

      const biweekly = nextOccurrence(
        {
          frequency: FrequencyEnum.BIWEEKLY,
          due_day: 15,
          created_at: new Date(2026, 7, 1),
        },
        today,
      );
      expect(biweekly).toEqual(new Date(2026, 7, 15));

      const quarterly = nextOccurrence(
        {
          frequency: FrequencyEnum.QUARTERLY,
          due_day: 15,
          created_at: new Date(2026, 0, 15),
        },
        today,
      );
      expect(quarterly).toEqual(new Date(2026, 9, 15));

      const yearly = nextOccurrence(
        {
          frequency: FrequencyEnum.YEARLY,
          due_day: 15,
          created_at: new Date(2025, 0, 15),
        },
        today,
      );
      expect(yearly).toEqual(new Date(2027, 0, 15));

      const monthly = nextOccurrence(
        {
          frequency: FrequencyEnum.MONTHLY,
          due_day: 20,
          created_at: new Date(2026, 0, 15),
        },
        today,
      );
      expect(monthly).toEqual(new Date(2026, 7, 20));
    });

    it('debe usar el comportamiento mensual por defecto para frecuencias desconocidas', () => {
      const result = nextOccurrence(
        {
          frequency: 'quincenal' as never,
          due_day: 20,
          created_at: new Date(2026, 0, 15),
        },
        today,
      );
      expect(result).toEqual(new Date(2026, 7, 20));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // daysInMonth
  // ─────────────────────────────────────────────────────────────
  describe('daysInMonth', () => {
    it('debe contar los días de febrero bisiesto y común', () => {
      expect(daysInMonth(2026, 1)).toBe(28);
      expect(daysInMonth(2028, 1)).toBe(29);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // handleDailyReminders
  // ─────────────────────────────────────────────────────────────
  describe('handleDailyReminders', () => {
    it('debe crear notificación cuando la deducción está dentro de la ventana', async () => {
      const tx = buildTx();
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      const reference = `fixed:reminder:1:2026-08-15`;
      expect(mockNotificationService.createIfMissing).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          title: expect.any(String) as string,
        }),
        reference,
      );
    });

    it('no debe notificar si la ocurrencia está fuera de la ventana', async () => {
      const tx = buildTx();
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);

      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockNotificationService.createIfMissing).not.toHaveBeenCalled();
    });

    it('debe ignorar transacciones sin due_day', async () => {
      const tx = buildTx({ due_day: null });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);

      await scheduler.handleDailyReminders();

      expect(mockNotificationService.createIfMissing).not.toHaveBeenCalled();
    });

    it('debe registrar el error si falla la consulta de transacciones', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      mockTransactionRepo.findFixedForReminders.mockRejectedValue(
        new Error('db caído'),
      );

      await scheduler.handleDailyReminders();

      expect(errorSpy).toHaveBeenCalled();
      expect(mockNotificationService.createIfMissing).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('debe notificar transacciones de frecuencia diaria', async () => {
      const tx = buildTx({ frequency: FrequencyEnum.DAILY, due_day: 15 });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-15T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockNotificationService.createIfMissing).toHaveBeenCalled();
    });

    it('debe usar 3 días de aviso cuando reminder_days es nulo', async () => {
      const tx = buildTx({ reminder_days: null });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockNotificationService.createIfMissing).toHaveBeenCalled();
    });

    it('debe registrar un warning si falla la creación de la notificación', async () => {
      const tx = buildTx();
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockRejectedValue(
        new Error('queue down'),
      );
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se pudo crear recordatorio'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('debe construir el mensaje de suscripción con método y entidad', async () => {
      const tx = buildTx({
        fixed_type: FixedTypeEnum.DEDUCTION,
        type: TransactionTypeEnum.EXPENSE,
        payment_method: 'bank_transfer',
        source_bank: 'Bancolombia',
        source_account: '1234',
      });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockNotificationService.createIfMissing).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          title: '[notification.UPCOMING_SUBSCRIPTION]',
          description: expect.stringContaining(
            '[notification.PAYMENT_METHOD]',
          ) as string,
        }),
        expect.any(String),
      );
    });

    it('debe incluir el método de pago aunque no haya entidad', async () => {
      const tx = buildTx({
        payment_method: 'cash',
        source_bank: undefined,
        source_account: undefined,
      });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockI18nService.t).toHaveBeenCalledWith(
        'notification.PAYMENT_METHOD',
        { args: { method: 'efectivo' } },
      );
      expect(mockI18nService.t).not.toHaveBeenCalledWith(
        'notification.SOURCE_ENTITY',
        expect.anything(),
      );
    });

    it('debe incluir la entidad aunque no haya método de pago', async () => {
      const tx = buildTx({
        payment_method: undefined,
        source_bank: 'Daviplata',
        source_account: '009',
      });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockI18nService.t).toHaveBeenCalledWith(
        'notification.SOURCE_ENTITY',
        { args: { source: 'Daviplata · 009' } },
      );
      expect(mockI18nService.t).not.toHaveBeenCalledWith(
        'notification.PAYMENT_METHOD',
        expect.anything(),
      );
    });

    it('debe construir el mensaje de inversión', async () => {
      const tx = buildTx({ type: TransactionTypeEnum.INVESTMENT });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockNotificationService.createIfMissing).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          title: '[notification.UPCOMING_INVESTMENT]',
        }),
        expect.any(String),
      );
    });

    it('debe construir el mensaje de ingreso', async () => {
      const tx = buildTx({ type: TransactionTypeEnum.INCOME });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockNotificationService.createIfMissing).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          title: '[notification.UPCOMING_INCOME]',
        }),
        expect.any(String),
      );
    });

    it('debe usar el addressee como concepto si falta la descripción', async () => {
      const tx = buildTx({
        description: undefined,
        addressee: 'Maria',
        payment_method: undefined,
        source_bank: undefined,
        source_account: undefined,
      });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockI18nService.t).toHaveBeenCalledWith(
        'notification.UPCOMING_DESCRIPTION',
        expect.objectContaining({
          args: expect.objectContaining({
            concept: 'Maria',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('debe usar un concepto genérico si no hay descripción ni addressee', async () => {
      const tx = buildTx({
        description: undefined,
        addressee: undefined,
        payment_method: undefined,
        source_bank: undefined,
        source_account: undefined,
      });
      mockTransactionRepo.findFixedForReminders.mockResolvedValue([tx]);
      mockNotificationService.createIfMissing.mockResolvedValue({ id: 1 });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T08:00:00'));

      await scheduler.handleDailyReminders();
      jest.useRealTimers();

      expect(mockI18nService.t).toHaveBeenCalledWith(
        'notification.UPCOMING_DESCRIPTION',
        expect.objectContaining({
          args: expect.objectContaining({
            concept: '[notification.GENERIC_MOVEMENT]',
          }) as Record<string, unknown>,
        }),
      );
      expect(mockNotificationService.createIfMissing).toHaveBeenCalled();
    });
  });
});
