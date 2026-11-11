import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TraceSheet } from '../../ui/Traces';
import { PrintDoc } from '../../ui/PrintDoc';
import { sampleProject } from '../../core/project';
import { calcAll } from '../../core/calc';
import { putPhoto } from '../../store/photos';
import type { Photo } from '../../core/types';

const wall = (o: Partial<Photo> = {}): Photo => ({ id: 'w1', tag: 'wall', line: 'l1', note: '', at: 1, ...o });

const surface = () => {
  const el = document.querySelector('.tr-wrap') as HTMLElement;
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
  return el;
};
const tap = (el: HTMLElement, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y });

describe('Trace sheet', () => {
  it('draws straight traces with notes and saves only complete ones', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<TraceSheet photo={wall()} url="blob:x" onSave={onSave} onClose={onClose} />);
    const el = surface();
    tap(el, 20, 10);
    tap(el, 120, 14);
    tap(el, 124, 80);
    fireEvent.change(screen.getByLabelText('Привязка трассы 1'), { target: { value: '15 см от потолка' } });
    fireEvent.click(screen.getByRole('button', { name: 'Новая трасса' }));
    tap(el, 50, 50);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSave).toHaveBeenCalledWith([{ pts: [100, 100, 600, 100, 600, 800], note: '15 см от потолка' }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('removes points and traces and draws freely without right angles', () => {
    const onSave = vi.fn();
    render(<TraceSheet photo={wall({ traces: [{ pts: [0, 0, 500, 0], note: 'a' }, { pts: [0, 0, 0, 500], note: 'b' }] })} url="blob:x" onSave={onSave} onClose={() => undefined} />);
    const el = surface();
    expect(screen.getByRole('button', { name: /Трасса 2/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить трассу' }));
    expect(screen.queryByLabelText('Привязка трассы 2')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Прямые углы' }));
    tap(el, 200, 100);
    fireEvent.click(screen.getByRole('button', { name: 'Убрать точку' }));
    tap(el, 100, 50);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSave).toHaveBeenCalledWith([{ pts: [0, 0, 500, 0, 500, 500], note: 'a' }]);
  });
});

describe('Wiring map print', () => {
  it('prints wall photos with traces and their notes', async () => {
    const p = sampleProject();
    p.photos = [
      wall({ line: p.lines[0].id, note: 'кухня, левая стена', traces: [{ pts: [0, 100, 600, 100], note: '15 см от потолка' }, { pts: [600, 100, 600, 900], note: '' }] }),
      wall({ id: 'w2', line: p.lines[1].id }),
      { id: 'b', tag: 'before', line: p.lines[0].id, note: '', at: 1 }
    ];
    await putPhoto('w1', new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
    const { container } = render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg, p)} mode="wiring" />);
    expect(container.textContent).toContain('Карта скрытой проводки');
    const figs = container.querySelectorAll('.wd-wall');
    expect(figs).toHaveLength(2);
    expect([...figs[0].querySelectorAll('.wd-list li')].map(li => li.textContent)).toEqual(['15 см от потолка', 'привязка не указана']);
    expect(figs[0].querySelectorAll('.tr-line')).toHaveLength(2);
    expect(figs[1].textContent).toContain('Трассы на этом фото не размечены');
    await waitFor(() => expect(figs[0].querySelector('img')).toBeTruthy());
  });

  it('mentions the map in the hidden works act', () => {
    const p = sampleProject();
    const a = calcAll(p.lines, p.cfg, p);
    const plain = render(<PrintDoc p={p} a={a} mode="hidden" />);
    expect(plain.container.textContent).toContain('рекомендуется приложить фото трасс');
    plain.unmount();
    p.photos = [wall({ line: p.lines[0].id, traces: [{ pts: [0, 0, 10, 0], note: '' }] })];
    const { container } = render(<PrintDoc p={p} a={a} mode="hidden" />);
    expect(container.textContent).toContain('Приложение: карта скрытой проводки');
  });

  it('explains how to start when there are no wall photos', () => {
    const p = sampleProject();
    const { container } = render(<PrintDoc p={p} a={calcAll(p.lines, p.cfg, p)} mode="wiring" />);
    expect(container.textContent).toContain('Фото стен пока нет');
  });
});
