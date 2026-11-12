import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import { wide } from './util';

const ed = () => document.querySelector('[aria-label="Редактор группы"]') as HTMLElement;

const folds = (): string[] => Array.from(ed().querySelectorAll('.fold-in > .why-t')).map(x => x.firstElementChild?.textContent ?? '');

const extras = (): HTMLElement | null => {
  const b = Array.from(ed().querySelectorAll<HTMLElement>('.fold-in > .why-t')).find(x => x.firstElementChild?.textContent === 'Дополнительно');
  return b ? (b.nextElementSibling as HTMLElement) : null;
};

const labels = (el: HTMLElement): string[] => Array.from(el.querySelectorAll('.lbl')).map(x => x.textContent ?? '');

const seed = (prot: string, obj = '') => {
  const ls = [
    mkLine('Свет кухни', 'light', 10, [['Лампа', 60, 4]]),
    mkLine('Розетки кухни', 'socket', 12, [['Чайник', 2200, 1]]),
    mkLine('Плита', 'power', 8, [['Плита', 5000, 1]])
  ];
  const p = newProject({ cfg: { ...defaultCfg(), prot, ...(obj ? { obj } : {}) }, lines: ls, sample: false }, 'Кв');
  localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
};

const open = (name: string) => {
  const row = Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.textContent?.includes(name));
  fireEvent.click(row as HTMLElement);
};

describe('group editor extras section', () => {
  it('is not shown for a lighting group when the room sits next to the length', () => {
    wide(true);
    seed('rcd');
    render(<App />);
    open('Свет кухни');
    expect(folds()).not.toContain('Дополнительно');
    expect(folds()).toContain('Замеры и фото');
    expect(ed().querySelector('[aria-label="Помещение для УЗО"]')).not.toBeNull();
  });

  it('appears again when the group type gets its own fields', () => {
    wide(true);
    seed('rcd');
    render(<App />);
    open('Свет кухни');
    fireEvent.click(ed().querySelector('input[name^="t-"][value="socket"]') as HTMLElement);
    const b = extras();
    expect(b).not.toBeNull();
    expect(labels(b as HTMLElement)).toEqual(['Условия']);
  });

  it('never opens empty in any group type, protection or object', () => {
    for (const prot of ['rcd', 'rcbo']) {
      for (const obj of ['', 'house']) {
        for (const name of ['Свет кухни', 'Розетки кухни', 'Плита']) {
          localStorage.clear();
          document.body.innerHTML = '';
          wide(true);
          seed(prot, obj);
          const { unmount } = render(<App />);
          open(name);
          const b = extras();
          if (b) expect(labels(b).length).toBeGreaterThan(0);
          else expect(prot === 'rcd' && obj === '' && name === 'Свет кухни').toBe(true);
          unmount();
        }
      }
    }
  });

  it('keeps the room, relay and conditions inside for a power group with per-group RCBO', () => {
    wide(true);
    seed('rcbo');
    render(<App />);
    open('Плита');
    expect(labels(extras() as HTMLElement)).toEqual(['Помещение', 'Реле приоритета нагрузки', 'Условия']);
  });
});
