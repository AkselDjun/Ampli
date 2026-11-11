import { describe, expect, it } from 'vitest';
import { OLD_EMPTY, normOld, oldAmp, oldGroups, oldMaxBreaker, oldStarted, oldVerdict } from '../../core/oldwire';
import { calcAll } from '../../core/calc';
import { normProject, sampleProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { cur, init, reducer } from '../../store/reducer';
import type { OldWiring } from '../../core/types';

const a = () => calcAll([
  mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]),
  mkLine('Плита', 'power', 6, [['Плита', 7000, 1]]),
  mkLine('Пусто', 'socket', 5, [])
], defaultCfg());
const w = (o: Partial<OldWiring>): OldWiring => ({ ...OLD_EMPTY, ...o });
const ids = (o: Partial<OldWiring>) => oldVerdict(w(o), a()).findings.map(f => f.id + ':' + f.k);

describe('old wiring data', () => {
  it('normalises answers', () => {
    expect(normOld(null)).toEqual(OLD_EMPTY);
    expect(normOld({ metal: 'al', sec: '2.5', pe: 'x', net: 'tnc', panel: 'old', ins: ' 0,8 ', age: 200, signs: ['twist', 'zz', 'heat'] })).toEqual({ metal: 'al', sec: 2.5, pe: '', net: 'tnc', panel: 'old', ins: '0,8', age: '', signs: ['heat', 'twist'] });
    expect(normOld({ sec: 3, ins: 'abc', signs: 'heat' })).toEqual(OLD_EMPTY);
    expect(oldStarted(undefined)).toBe(false);
    expect(oldStarted(OLD_EMPTY)).toBe(false);
    expect(oldStarted(w({ age: '5' }))).toBe(true);
    expect(oldStarted(w({ signs: ['trip'] }))).toBe(true);
  });

  it('gives ampacity and the largest breaker', () => {
    expect([oldAmp('al', 2.5), oldMaxBreaker('al', 2.5), oldMaxBreaker('al', 6), oldMaxBreaker('cu', 2.5), oldAmp('al', 1.5), oldMaxBreaker('al', 1.5)]).toEqual([19, 16, 25, 25, 0, 0]);
  });

  it('is kept by the project only when started and edited by the reducer', () => {
    const p = sampleProject();
    expect(normProject({ ...p, old: OLD_EMPTY })?.old).toBeUndefined();
    expect(normProject({ ...p, old: { metal: 'cu' } })?.old?.metal).toBe('cu');
    let s = init({ cur: p.id, list: [p] });
    s = reducer(s, { t: 'old', field: 'metal', value: 'al' });
    s = reducer(s, { t: 'oldSign', id: 'heat', on: true });
    s = reducer(s, { t: 'oldSign', id: 'twist', on: true });
    s = reducer(s, { t: 'oldSign', id: 'heat', on: false });
    expect(cur(s).old).toEqual(w({ metal: 'al', signs: ['twist'] }));
    s = reducer(s, { t: 'oldReset' });
    expect(cur(s).old).toBeUndefined();
    s = reducer(s, { t: 'oldSign', id: 'trip', on: true });
    expect(cur(s).old?.signs).toEqual(['trip']);
  });
});

describe('old wiring verdict', () => {
  it('is empty before the survey', () => {
    expect(oldVerdict(undefined, a())).toEqual({ status: 'none', label: 'Не обследована', findings: [], groups: [] });
  });

  it('flags the N-PE jumper and the two-wire network', () => {
    expect(ids({ pe: 'jumper' })).toEqual(['jumper:bad', 'nope:warn', 'ins:warn']);
    expect(ids({ pe: 'no', net: 'tnc' })).toEqual(['nope:warn', 'tnc:warn', 'ins:warn']);
    const v = oldVerdict(w({ pe: 'yes', net: 'tncs', ins: '1.2', panel: 'mod' }), a());
    expect(v.status).toBe('ok');
    expect(v.label).toBe('Можно оставить');
    expect(v.findings.find(f => f.id === 'panel')?.practice).toBe(true);
  });

  it('checks aluminium, insulation and groups', () => {
    const v = oldVerdict(w({ metal: 'al', sec: 2.5, ins: '0.3', age: '30' }), a());
    expect(v.status).toBe('bad');
    expect(v.findings.map(f => f.id + ':' + f.k)).toEqual(['al:warn', 'amp:ok', 'ins:bad', 'age:warn', 'groups:bad']);
    expect(v.findings.find(f => f.id === 'amp')?.text).toContain('автомат не больше 16 А');
    expect(v.groups.map(g => g.fit)).toEqual([true, false]);
    expect(v.findings.find(f => f.id === 'groups')?.title).toBe('1 группа не подходит для старой линии');
    expect(ids({ metal: 'al', sec: 1.5 })).toContain('al:bad');
  });

  it('compares copper sections and age', () => {
    expect(oldGroups(w({ metal: 'cu', sec: 1.5 }), a()).map(g => g.fit)).toEqual([true, false]);
    expect(oldGroups(w({ metal: 'cu' }), a())).toEqual([]);
    expect(ids({ metal: 'cu', age: '29' })).toEqual(['ins:warn']);
    expect(ids({ metal: 'cu', age: '30' })).toContain('age:warn');
  });

  it('lists signs and panels', () => {
    const v = oldVerdict(w({ signs: ['heat', 'twist'], panel: 'fuse' }), a());
    const s = v.findings.find(f => f.id === 'signs');
    expect(s?.text.startsWith('Потемнение')).toBe(true);
    expect(s?.text).toContain('скрутки меди с алюминием');
    expect(v.findings.find(f => f.id === 'panel')?.k).toBe('bad');
    expect(ids({ panel: 'old' })).toContain('panel:warn');
  });
});
