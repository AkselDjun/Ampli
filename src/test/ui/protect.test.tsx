import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { PanelPane } from '../../ui/Side';
import { PanelMode } from '../../ui/PanelMode';
import { PrintDoc } from '../../ui/PrintDoc';
import { DrawingA3 } from '../../ui/DrawingA3';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import type { Cfg, Line, Project } from '../../core/types';
import { dlg, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const lines = (): Line[] => [
  { ...mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]), zone: 'Комнаты' },
  { ...mkLine('Стиралка', 'power', 8, [['Стиральная машина', 2200, 1]]), zone: 'Ванная' }
];
const proj = (cfg: Partial<Cfg> = {}): Project => ({ ...newProject({ cfg: { ...defaultCfg(), prot: 'rcbo', ...cfg }, lines: lines(), sample: false }, 'Тест') });

describe('panel protection switches', () => {
  it('turns the relay and the surge protector on from the network sheet', () => {
    wide(true);
    render(<App />);
    fireEvent.click(document.querySelector('.col-list .netfold') as HTMLElement);
    const d = dlg('Параметры сети');
    fireEvent.click(within(d).getByLabelText(/Реле контроля напряжения/));
    fireEvent.click(within(d).getByLabelText(/УЗИП тип 2/));
    expect(stored().list[0].cfg.vr).toBe('on');
    expect(stored().list[0].cfg.spd).toBe('on');
    expect((document.querySelector('.col-list .netfold') as HTMLElement).textContent).toContain('реле напряжения, УЗИП');
    expect(document.querySelectorAll('.rail .dev-vr, .rail .dev-spd').length).toBe(2);
    fireEvent.click(within(d).getByLabelText(/УЗИП тип 2/));
    expect(stored().list[0].cfg.spd).toBe('');
  });
});

describe('board, stickers, drawing and report', () => {
  it('shows the relay and the surge protector on the board and in the list', () => {
    const p = proj({ vr: 'on', spd: 'on' });
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    const caps = Array.from(document.querySelectorAll('.rail .dev-cap')).map(e => e.textContent);
    expect(caps.slice(0, 3)).toEqual(['Ввод', 'Реле U', 'УЗИП']);
    const legend = (document.querySelector('.legend') as HTMLElement).textContent;
    expect(legend).toContain('Реле напряжения');
    expect(legend).toContain('УЗИП');
    const list = (document.querySelector('.bd-list') as HTMLElement).textContent ?? '';
    expect(list).toContain('Реле контроля напряжения');
    expect(list).toContain('Защита от перенапряжений');
    expect(list).toContain('тип 2, 1P+N');
    expect(list).toContain('дифавтомат 30 мА, тип A');
  });

  it('shows three-phase relay text and RCD type A in room mode', () => {
    const p = proj({ vr: 'on', spd: 'on', supply: 3, prot: 'rcd' } as Partial<Cfg>);
    render(<PanelPane a={calcAll(p.lines, p.cfg)} />);
    const list = (document.querySelector('.bd-list') as HTMLElement).textContent ?? '';
    expect(list).toContain('по одному на фазу');
    expect(list).toContain('тип 2, 3P+N');
    expect(list).toContain('30 мА, тип A, своя шина N');
  });

  it('labels the extra modules in the measuring board', () => {
    const p = proj({ vr: 'on', spd: 'on' });
    render(<PanelMode open onClose={() => undefined} a={calcAll(p.lines, p.cfg)} dispatch={() => undefined} />);
    const strips = Array.from(document.querySelectorAll('.pmb-dev.k-vr .pmb-strip, .pmb-dev.k-spd .pmb-strip')).map(e => e.textContent);
    expect(strips).toEqual(['Реле Uнапряжение', 'УЗИПперенапряж.']);
  });

  it('prints stickers for the extra modules', () => {
    const p = proj({ vr: 'on', spd: 'on' });
    render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg)} mode="stickers" />);
    const legend = Array.from(document.querySelectorAll('.stk-legend .stk-k')).map(e => e.textContent);
    expect(legend.slice(0, 3)).toEqual(['Ввод', 'Реле U', 'УЗИП']);
    expect(document.querySelector('.stk-i.k-spd')?.textContent).toContain('Защита от перенапряжений');
    expect(document.querySelector('.stk-i.k-vr')?.textContent).toContain('Контроль напряжения');
  });

  it('draws KV1 and FV1 and lists them in the report', () => {
    const p = proj({ vr: 'on', spd: 'on' });
    const a = calcAll(p.lines, p.cfg);
    const { unmount } = render(<DrawingA3 p={p} a={a} company="" />);
    const t = Array.from(document.querySelectorAll('svg.a3 text')).map(e => e.textContent).join(' ');
    expect(t).toContain('KV1 реле напряжения');
    expect(t).toContain('FV1');
    expect(t).toContain('УЗИП FV1 тип 2 1P+N.');
    expect(t).toContain('30, тип A');
    unmount();
    render(<PrintDoc p={p} a={a} />);
    const r = (document.querySelector('.printdoc') as HTMLElement).textContent ?? '';
    expect(r).toContain('тип A для групп с электроникой');
    expect(r).toContain('Реле контроля напряжения после вводного автомата.');
    expect(r).toContain('УЗИП тип 2 после вводного автомата.');
  });

  it('draws the relay through a contactor on a large input and room RCD type A', () => {
    const big = Array.from({ length: 2 }, (_, i) => mkLine('П' + i, 'power', 5, [['Плита', 7000, 1]]));
    const p = { ...newProject({ cfg: { ...defaultCfg(), vr: 'on', ko: 1, prot: 'rcd' }, lines: [...lines(), ...big], sample: false }, 'Т') };
    render(<DrawingA3 p={p} a={calcAll(p.lines, p.cfg)} company="" />);
    const t = Array.from(document.querySelectorAll('svg.a3 text')).map(e => e.textContent).join(' ');
    expect(t).toContain('через контактор.');
    expect(t).toMatch(/QD\d \/ 30, тип A/);
    expect(t).toMatch(/\d+ А, 30 мА, тип A/);
  });
});

describe('editor', () => {
  it('names RCD type A in the result tile', () => {
    wide(true);
    const p = proj();
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    fireEvent.click(document.querySelectorAll<HTMLElement>('.rows .row')[1]);
    expect(screen.getByText('дифавтомат 30 мА, тип A')).toBeTruthy();
    expect(Array.from(document.querySelectorAll('.col-edit .notes li.tip-n')).map(li => li.textContent).join(' ')).toContain('УЗО типа A');
  });
});
