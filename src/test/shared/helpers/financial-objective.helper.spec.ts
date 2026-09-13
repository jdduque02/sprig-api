import {
  applyCompletion,
  computeObjectiveProgress,
  todayInTimeZone,
} from '@shared/helpers/financial-objective.helper';

describe('financial-objective.helper', () => {
  describe('applyCompletion', () => {
    it('marca como completada cuando el saldo alcanza la meta', () => {
      const objective = {
        current_balance: 1000,
        target_amount: 1000,
        is_completed: false,
        completed_at: null,
      };
      applyCompletion(objective);
      expect(objective.is_completed).toBe(true);
      expect(objective.completed_at).toBeInstanceOf(Date);
    });

    it('no sobreescribe completed_at si ya existe', () => {
      const existing = new Date('2024-01-01');
      const objective = {
        current_balance: 2000,
        target_amount: 1000,
        is_completed: false,
        completed_at: existing,
      };
      applyCompletion(objective);
      expect(objective.is_completed).toBe(true);
      expect(objective.completed_at).toBe(existing);
    });

    it('marca como no completada cuando el saldo no alcanza la meta', () => {
      const objective = {
        current_balance: 500,
        target_amount: 1000,
        is_completed: true,
        completed_at: new Date(),
      };
      applyCompletion(objective);
      expect(objective.is_completed).toBe(false);
      expect(objective.completed_at).toBeNull();
    });

    it('trata current_balance nulo como cero', () => {
      const objective = {
        current_balance: null,
        target_amount: 1000,
        is_completed: true,
        completed_at: null,
      };
      applyCompletion(objective as never);
      expect(objective.is_completed).toBe(false);
    });

    it('no auto-completa una meta sin monto objetivo', () => {
      const objective = {
        current_balance: 1000,
        target_amount: null,
        is_completed: true,
        completed_at: new Date(),
      };
      applyCompletion(objective);
      expect(objective.is_completed).toBe(false);
      expect(objective.completed_at).toBeNull();
    });
  });

  describe('todayInTimeZone', () => {
    it('devuelve la fecha en formato YYYY-MM-DD en la zona indicada', () => {
      const result = todayInTimeZone('America/Bogota');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('usa America/Bogota por defecto si no se pasa zona', () => {
      const result = todayInTimeZone('');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('computeObjectiveProgress', () => {
    it('calcula monto restante, porcentaje y días restantes', () => {
      const progress = computeObjectiveProgress({
        current_balance: 500,
        target_amount: 1000,
        end_date: new Date(Date.now() + 10 * 86400000).toISOString(),
      });
      expect(progress.amount_remaining).toBe(500);
      expect(progress.progress_percent).toBe(50);
      expect(progress.days_remaining).toBeGreaterThanOrEqual(9);
    });

    it('devolvió 0 en días restantes cuando la meta ya venció', () => {
      const progress = computeObjectiveProgress({
        current_balance: 1000,
        target_amount: 1000,
        end_date: new Date(Date.now() - 86400000).toISOString(),
      });
      expect(progress.days_remaining).toBe(0);
      expect(progress.amount_remaining).toBe(0);
    });

    it('devuelve días_remaining null cuando no hay end_date', () => {
      const progress = computeObjectiveProgress({
        current_balance: 100,
        target_amount: 200,
        end_date: null,
      });
      expect(progress.days_remaining).toBeNull();
      expect(progress.progress_percent).toBe(50);
    });

    it('devuelve 0 de progreso cuando el target es 0', () => {
      const progress = computeObjectiveProgress({
        current_balance: 100,
        target_amount: 0,
        end_date: null,
      });
      expect(progress.progress_percent).toBe(0);
    });

    it('devuelve progreso null cuando no hay monto objetivo', () => {
      const progress = computeObjectiveProgress({
        current_balance: null,
        target_amount: null,
        end_date: null,
      });
      expect(progress.amount_remaining).toBeNull();
      expect(progress.progress_percent).toBeNull();
    });
  });
});
