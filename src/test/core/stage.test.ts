import { describe, expect, it } from 'vitest';
import { STAGES, normStage, stageOf } from '../../core/stage';

describe('этап проекта', () => {
  it('пять этапов от расчёта до сдачи', () => {
    expect(STAGES.map(s => s.name)).toEqual(['Расчёт', 'Смета отправлена', 'Монтаж', 'Приёмка', 'Сдан']);
  });

  it('у каждого этапа кроме последнего есть следующий шаг с переходом', () => {
    for (const s of STAGES.slice(0, -1)) {
      expect(s.next.length).toBeGreaterThan(0);
      expect(s.act).toBeDefined();
    }
    expect(STAGES[4].act).toBeUndefined();
  });

  it('этап без значения считается расчётом', () => {
    expect(stageOf({})).toBe(0);
    expect(stageOf({ stage: 3 })).toBe(3);
  });

  it('чужие значения сводятся к допустимым', () => {
    expect(normStage(7)).toBe(4);
    expect(normStage(-2)).toBeUndefined();
    expect(normStage(2.6)).toBe(2);
    expect(normStage('3')).toBeUndefined();
    expect(normStage(0)).toBeUndefined();
    expect(normStage(Number.NaN)).toBeUndefined();
  });
});
