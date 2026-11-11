import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { App } from '../../ui/App';
import { newProject } from '../../core/project';
import { defaultCfg, mkLine } from '../../core/templates';
import { KEY } from '../../store/storage';
import { byLabel, change, dlg, wide } from './util';
import { stored } from '../stored';

vi.setConfig({ testTimeout: 60000 });

const ed = () => document.querySelector('.col-edit') as HTMLElement;
const net = () => {
  fireEvent.click(document.querySelector('.col-list .netfold') as HTMLElement);
  return dlg('Параметры сети');
};

describe('private house in the app', () => {
  it('switches the project to a house and edits the input and grounding', () => {
    wide(true);
    render(<App />);
    const d = net();
    expect(d.textContent).not.toContain('Ввод СИП от опоры');
    expect(d.textContent).toContain('УЗИП тип 2');
    fireEvent.click(d.querySelector('input[name="obj"][value="house"]') as HTMLElement);
    expect(stored().list[0].cfg).toMatchObject({ obj: 'house', spd: 'on', sip: 20 });
    expect(d.textContent).toContain('УЗИП тип 1+2');
    expect(d.textContent).toContain('Отключит дом');
    const sip = byLabel(d, 'Длина ввода СИП от опоры, м');
    fireEvent.click((sip.parentElement as HTMLElement).querySelectorAll('button')[1]);
    expect(stored().list[0].cfg.sip).toBe(25);
    const rz = byLabel(d, 'Сопротивление повторного заземления, Ом');
    expect(rz.value).toBe('');
    change(rz, '18');
    expect(stored().list[0].cfg.rz).toBe('18');
    fireEvent.click((rz.parentElement as HTMLElement).querySelectorAll('button')[1]);
    expect(stored().list[0].cfg.rz).toBe(19);
    fireEvent.click(d.querySelector('input[name="obj"][value="flat"]') as HTMLElement);
    expect(stored().list[0].cfg.obj).toBe('');
    expect(d.textContent).not.toContain('Ввод СИП от опоры');
  });

  it('marks a lighting group as outdoor in a house', () => {
    wide(true);
    const ls = [mkLine('Фонари', 'light', 30, null, null, [['Фонарь', 60, 2]])];
    const p = newProject({ cfg: { ...defaultCfg(), obj: 'house', spd: 'on', sip: 20 }, lines: ls, sample: false }, 'Дом');
    localStorage.setItem(KEY, JSON.stringify({ cur: p.id, list: [p] }));
    render(<App />);
    fireEvent.click(document.querySelector('.rows .row') as HTMLElement);
    expect(ed().textContent).toContain('Условия');
    fireEvent.click(ed().querySelector('input[name^="w-"][value="out"]') as HTMLElement);
    expect(stored().list[0].lines[0]).toMatchObject({ out: true, wet: false });
    expect(ed().textContent).toContain('на улице');
  });
});
