import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { App } from '../../ui/App';
import { wide } from './util';

const open = (name: string): HTMLElement => {
  const row = Array.from(document.querySelectorAll<HTMLElement>('.rows .row')).find(x => x.textContent?.includes(name));
  fireEvent.click(row as HTMLElement);
  return document.querySelector('[aria-label="Редактор группы"]') as HTMLElement;
};

describe('compact group card', () => {
  it('puts the group type before the appliance list', () => {
    wide(false);
    render(<App />);
    const ed = open('Варочная');
    const type = Array.from(ed.querySelectorAll('.lbl')).find(x => x.textContent === 'Тип группы') as Element;
    const apps = ed.querySelector('.apps') as Element;
    expect(type.compareDocumentPosition(apps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not offer an appliance the power group already has', () => {
    wide(false);
    render(<App />);
    const ed = open('Варочная');
    const chips = Array.from(ed.querySelectorAll('.chip')).map(x => x.textContent?.trim());
    expect(chips).not.toContain('+ Варочная панель');
    expect(chips).toContain('+ Духовой шкаф');
    expect(ed.querySelector('.tips-fold summary')?.textContent).toMatch(/^\d+ совет\S*, не нарушения норм$/);
  });
});
