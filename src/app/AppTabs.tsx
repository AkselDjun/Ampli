import { IconCheck, IconDoc, IconList, IconPanel } from '../ui/Icons';
import { APP_VIEW } from './types';
import type { AppTabsProps } from './types';

export function AppTabs({ calc, view, onGroups, onPanel, onWork, onReport }: AppTabsProps) {
  return (
    <nav className="tabs" aria-label="Разделы" data-tour="reports">
      <button type="button" onClick={onGroups} aria-current={view === APP_VIEW.GROUPS || view === APP_VIEW.EDITOR ? 'page' : undefined}>
        <IconList />
        <span>Группы</span>
        {calc.issues > 0 && <em className="badge">{calc.issues}</em>}
      </button>
      <button type="button" data-tour="panel" onClick={onPanel} aria-current={view === APP_VIEW.PANEL ? 'page' : undefined}>
        <IconPanel />
        <span>Щиток</span>
      </button>
      <button type="button" data-tour="work" onClick={onWork}>
        <IconCheck />
        <span>Приёмка</span>
      </button>
      <button type="button" data-tour="report" onClick={onReport}>
        <IconDoc />
        <span>Отчёт</span>
      </button>
    </nav>
  );
}
