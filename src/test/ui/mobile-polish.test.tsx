import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../ui/App';
import { MeasBoard } from '../../ui/MeasBoard';
import { Onboarding } from '../../ui/Onboarding';
import { Totals } from '../../ui/Totals';
import { LISTBY_KEY } from '../../ui/prefs';
import { calcAll } from '../../core/calc';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import { cur, init, reducer } from '../../store/reducer';
import { chapterHintPending, markChapterHint } from '../../features/onboarding/storage';
import { TOUR_CHAPTER, chapterStart } from '../../features/onboarding/model';
import { ONBOARDING_STEPS } from '../../features/onboarding/steps';
import type { Cfg, Line, Project } from '../../core/types';
import { byLabel, toastText, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const zl = (l: Line, zone: string): Line => ({ ...l, zone });
const proj = (ls: Line[], cfg: Partial<Cfg> = {}): Project => ({ ...newProject({ cfg: { ...defaultCfg(), prot: 'rcbo', ...cfg }, lines: ls, sample: false }, 'Тест'), lines: ls });
const mixed = (): Line[] => [
  zl(mkLine('Свет кухни', 'light', 5, [['Лампа', 100, 1]]), 'Кухня'),
  mkLine('Розетки коридора', 'socket', 5, [['Пылесос', 1600, 1]]),
  zl(mkLine('Свет комнат', 'light', 5, [['Люстра', 100, 1]]), 'Комнаты'),
  zl(mkLine('Розетки кухни', 'socket', 5, [['Чайник', 2000, 1]]), 'кухня')
];
const save = (p: Project) => localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));

describe('renumbering groups by rooms', () => {
  it('sorts lines by the first appearance of each room and keeps groups without a room last', () => {
    const ls = mixed();
    const p = proj(ls);
    const st = init({ cur: p.id, list: [p] });
    const next = reducer(st, { t: 'sortByZone' });
    expect(cur(next).lines.map(l => l.name)).toEqual(['Свет кухни', 'Розетки кухни', 'Свет комнат', 'Розетки коридора']);
    expect(reducer(next, { t: 'sortByZone' })).toBe(next);
  });

  it('offers the button only when the numbers jump inside rooms and renumbers on click', () => {
    wide(true);
    save(proj(mixed()));
    localStorage.setItem(LISTBY_KEY, 'room');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Номера по порядку' }));
    expect(stored().list[0].lines.map((l: Line) => l.name)).toEqual(['Свет кухни', 'Розетки кухни', 'Свет комнат', 'Розетки коридора']);
    expect(toastText()).toBe('Группы перенумерованы по помещениям');
    expect(screen.queryByRole('button', { name: 'Номера по порядку' })).toBeNull();
  });
});

describe('breaker load in the group list', () => {
  it('shows a load bar under each breaker and marks it above 90 %', () => {
    wide(true);
    save(proj([
      mkLine('Лампы', 'light', 5, [['Лампа', 100, 1]]),
      mkLine('Духовка', 'power', 5, [['Духовка', 3600, 1]])
    ]));
    render(<App />);
    const brk = Array.from(document.querySelectorAll<HTMLElement>('.rows .brk'));
    expect(brk).toHaveLength(2);
    expect(brk[0].getAttribute('data-tip')).toMatch(/^Загрузка автомата \d+ %, дифавтомат 30 мА$/);
    expect(brk[0].querySelector('.brk-load')).not.toHaveClass('warn');
    expect(brk[1].querySelector('.brk-load')).toHaveClass('warn');
    expect((brk[1].querySelector('.brk-load i') as HTMLElement).style.width).toMatch(/^(9[1-9]|100)%$/);
  });

  it('names the RCD zone when groups share an RCD', () => {
    wide(true);
    save(proj([zl(mkLine('Лампы', 'light', 5, [['Лампа', 100, 1]]), 'Комнаты')], { prot: 'rcd' }));
    render(<App />);
    expect(document.querySelector('.rows .brk')?.getAttribute('data-tip')).toMatch(/УЗО «Комнаты» 30 мА$/);
  });
});

describe('short header labels', () => {
  it('keeps the long and the short power label for narrow screens', () => {
    const p = proj([mkLine('Лампы', 'light', 5, [['Лампа', 100, 1]])]);
    render(<Totals a={calcAll(p.lines, p.cfg)} onNet={() => undefined} />);
    expect(document.querySelector('.kp-l')?.textContent).toBe('Мощность');
    expect(document.querySelector('.kp-s')?.textContent).toBe('кВт');
    expect(document.querySelector('.kp-u')?.textContent).toBe(' кВт');
  });
});

describe('measuring on the board with the keyboard', () => {
  const lines = (): Line[] => [
    zl(mkLine('Свет', 'light', 10, [['Люстра', 200, 1]]), 'Комнаты'),
    zl(mkLine('Розетки', 'socket', 10, [['ТВ', 1500, 1]]), 'Комнаты'),
    zl(mkLine('Кухня', 'socket', 8, [['Чайник', 2000, 1]]), 'Кухня'),
    zl(mkLine('Ванная', 'socket', 8, [['Фен', 1200, 1]]), 'Ванная')
  ];
  const raf = () => vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });

  it('moves through the fields on Enter and then to the next group', () => {
    raf();
    const p = proj(lines());
    render(<MeasBoard open a={calcAll(p.lines, p.cfg)} dispatch={vi.fn()} />);
    const d = document.querySelector('.mb') as HTMLElement;
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г1');
    const ins = Array.from(d.querySelectorAll<HTMLInputElement>('.pm-in input'));
    expect(ins.length).toBeGreaterThan(1);
    expect(ins[0]).toHaveAttribute('enterkeyhint', 'next');
    ins[0].focus();
    fireEvent.keyDown(ins[0], { key: 'Tab' });
    expect(document.activeElement).toBe(ins[0]);
    fireEvent.keyDown(ins[0], { key: 'Enter' });
    expect(document.activeElement).toBe(ins[1]);
    fireEvent.keyDown(ins[ins.length - 1], { key: 'Enter' });
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г2');
    expect(document.activeElement).toBe(d.querySelector('.pm-in input'));
    expect(d.querySelector('.pm-kb')?.textContent).toContain('Enter');
    vi.restoreAllMocks();
  });

  it('stays on the last group after the last field', () => {
    raf();
    const p = proj(lines());
    render(<MeasBoard open a={calcAll(p.lines, p.cfg)} dispatch={vi.fn()} />);
    const d = document.querySelector('.mb') as HTMLElement;
    const devs = d.querySelectorAll<HTMLElement>('button.pmb-dev');
    fireEvent.click(devs[devs.length - 1]);
    const ins = Array.from(d.querySelectorAll<HTMLInputElement>('.pm-in input'));
    fireEvent.keyDown(ins[ins.length - 1], { key: 'Enter' });
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г4');
    vi.restoreAllMocks();
  });

  it('jumps to the next unmeasured group when the next one is already measured', () => {
    raf();
    const ls = lines();
    ls[1].meas = { zs: '0.2' };
    const p = proj(ls);
    render(<MeasBoard open a={calcAll(p.lines, p.cfg)} dispatch={vi.fn()} />);
    const d = document.querySelector('.mb') as HTMLElement;
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г1');
    fireEvent.click(within(d).getByRole('button', { name: 'К неизмеренной: Г3' }));
    expect(d.querySelector('.pm .no')?.textContent).toBe('Г3');
    expect(within(d).queryByRole('button', { name: /К неизмеренной/ })).toBeNull();
    expect(byLabel(d, 'Г3: Петля фаза-нуль, Ом')).toBe(document.activeElement);
    vi.restoreAllMocks();
  });
});

describe('chapter hints', () => {
  it('remembers that a chapter hint was shown', () => {
    localStorage.removeItem('ampli-chapter-hint-build');
    expect(chapterHintPending(TOUR_CHAPTER.BUILD)).toBe(true);
    markChapterHint(TOUR_CHAPTER.BUILD);
    expect(chapterHintPending(TOUR_CHAPTER.BUILD)).toBe(false);
  });

  it('starts the tour right at the chapter', () => {
    render(<Onboarding chapter={TOUR_CHAPTER.HANDOVER} onScene={() => undefined} onClose={() => undefined} />);
    expect(document.querySelector('.tour [role="dialog"] h2')?.textContent).toBe(ONBOARDING_STEPS[chapterStart(ONBOARDING_STEPS, TOUR_CHAPTER.HANDOVER)].title);
  });

  it('offers the documents tour once on the first visit to the report', async () => {
    localStorage.removeItem('ampli-chapter-hint-handover');
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Разделы' });
    fireEvent.click(within(nav).getByRole('button', { name: /Отчёт/ }));
    await waitFor(() => expect(document.querySelector('.sheet:not([hidden]) .sheet-hint')).not.toBeNull());
    const hint = document.querySelector('.sheet:not([hidden]) .sheet-hint') as HTMLElement;
    expect(hint.textContent).toContain('Впервые в документах');
    fireEvent.click(within(hint).getByRole('button', { name: 'Показать' }));
    expect(document.querySelector('.tour [role="dialog"] h2')?.textContent).toBe(ONBOARDING_STEPS[chapterStart(ONBOARDING_STEPS, TOUR_CHAPTER.HANDOVER)].title);
    expect(chapterHintPending(TOUR_CHAPTER.HANDOVER)).toBe(false);
  });

  it('stays quiet when the hint was already shown', async () => {
    markChapterHint(TOUR_CHAPTER.HANDOVER);
    const { unmount } = render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /Отчёт/ }));
    await new Promise(r => setTimeout(r, 10));
    expect(document.querySelector('.sheet-hint')).toBeNull();
    unmount();
  });
});
