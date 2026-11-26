import { describe, expect, it } from 'vitest';
import { cur, init, reducer } from '../../store/reducer';
import type { Action, State } from '../../store/reducer';
import { sampleProject } from '../../core/project';
import { NOTE_MAX, NOTES_MAX } from '../../core/notes';

const mk = (): State => {
  const p = sampleProject();
  return init({ cur: p.id, list: [p] });
};
const run = (s: State, ...as: Action[]): State => as.reduce(reducer, s);
const snap = { at: 5, lines: [{ id: 'x', name: 'Свет', zone: '', pd: 100, In: 10, curve: 'C', S: 1.5, len: 10 }] };

describe('этап проекта', () => {
  it('меняет этап и запоминает отправленную смету', () => {
    let s = run(mk(), { t: 'stage', n: 1, sent: snap });
    expect(cur(s).stage).toBe(1);
    expect(cur(s).sent).toEqual(snap);
    s = run(s, { t: 'stage', n: 3 });
    expect(cur(s).stage).toBe(3);
    expect(cur(s).sent).toEqual(snap);
  });

  it('возврат к расчёту убирает этап, но не снимок', () => {
    const s = run(mk(), { t: 'stage', n: 1, sent: snap }, { t: 'stage', n: 0 });
    expect(cur(s).stage).toBeUndefined();
    expect(cur(s).sent).toEqual(snap);
  });

  it('этап сверх последнего сводится к «Сдан»', () => {
    expect(cur(run(mk(), { t: 'stage', n: 9 })).stage).toBe(4);
  });
});

describe('заметки к группе', () => {
  it('добавляет, отмечает и удаляет', () => {
    const s0 = mk();
    const id = cur(s0).lines[0].id;
    let s = run(s0, { t: 'noteAdd', line: id, text: '  Проверить коробку  ' }, { t: 'noteAdd', line: id, text: '   ' });
    const notes = cur(s).lines[0].notes ?? [];
    expect(notes.map(n => n.t)).toEqual(['Проверить коробку']);
    expect(notes[0].at).toBeGreaterThan(0);
    s = run(s, { t: 'noteToggle', line: id, id: notes[0].id });
    expect(cur(s).lines[0].notes?.[0].done).toBe(true);
    s = run(s, { t: 'noteToggle', line: id, id: notes[0].id });
    expect(cur(s).lines[0].notes?.[0].done).toBeUndefined();
    s = run(s, { t: 'noteDel', line: id, id: notes[0].id });
    expect(cur(s).lines[0].notes).toBeUndefined();
  });

  it('обрезает текст и держит предел', () => {
    const s0 = mk();
    const id = cur(s0).lines[0].id;
    let s = run(s0, { t: 'noteAdd', line: id, text: 'x'.repeat(NOTE_MAX + 50) });
    expect(cur(s).lines[0].notes?.[0].t).toHaveLength(NOTE_MAX);
    for (let i = 0; i < NOTES_MAX + 5; i++) s = run(s, { t: 'noteAdd', line: id, text: 'n' + i });
    expect(cur(s).lines[0].notes).toHaveLength(NOTES_MAX);
  });

  it('копия группы без заметок', () => {
    const s0 = mk();
    const id = cur(s0).lines[0].id;
    const s = run(s0, { t: 'noteAdd', line: id, text: 'a' }, { t: 'dupLine', id });
    expect(cur(s).lines[1].notes).toBeUndefined();
  });
});
