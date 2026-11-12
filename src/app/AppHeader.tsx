import { Brand, IconBack, IconCheck, IconDoc, IconMeter, IconSearch } from '../ui/Icons';
import { Checks } from '../ui/Checks';
import { Totals } from '../ui/Totals';
import { Button } from '../ui/kit';
import type { AppHeaderProps } from './types';

export function AppHeader({ selected, selectedIndex, saveStatus, calc, onBack, onNetwork, onGroup, onCheckFix, onTour, onPanel, onWork, onReport, onCompare, onSearch }: AppHeaderProps) {
  return (
    <header className="appbar">
      <div className="in">
        <div className="ab-edit">
          <button className="ab-back" type="button" onClick={onBack} aria-label="Назад к группам"><IconBack /></button>
          <div className="ab-tw">
            <h1 className="ab-title">{selected ? 'Г' + (selectedIndex + 1) + ' ' + (selected.name || 'Без названия') : ''}</h1>
            <div id="ab-sub" className="ab-sub" />
          </div>
          <Button variant="primary" size="sm" onClick={onBack}>Готово</Button>
        </div>
        <div className="ab-main">
          <h1 className="brand"><Brand /><span>Ampli</span></h1>
          <span className="save-indicator" aria-live="polite">{saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'saved' ? 'Сохранено' : saveStatus === 'conflict' ? 'Конфликт вкладок' : 'Ошибка сохранения проектов'}</span>
          <div className="hud" data-tour="summary">
            <Totals a={calc} onNet={onNetwork} onCompare={onCompare} />
            <Checks a={calc} onGroup={onGroup} onFix={onCheckFix} />
          </div>
          <button className="ab-btn desk ab-find" type="button" aria-label="Найти действие или группу" aria-keyshortcuts="Control+K" onClick={onSearch}>
            <IconSearch />
            <span className="ab-txt" aria-hidden="true">Найти</span>
            <kbd className="ab-kbd" aria-hidden="true">Ctrl K</kbd>
          </button>
          <button className="ab-btn tour-help" type="button" data-tip="Обучение" aria-label="Открыть обучение" onClick={onTour}>?</button>
          <button className="ab-btn" type="button" data-tour="panel" data-tip="Замеры на щитке" aria-label="Замеры на щитке" onClick={onPanel}>
            <IconMeter />
            <span className="ab-txt">Замеры</span>
          </button>
          <button className="ab-btn desk" type="button" data-tour="work" data-tip="Монтаж и приёмка" onClick={onWork}>
            <IconCheck />
            <span className="ab-txt">Приёмка</span>
          </button>
          <button className="ab-btn desk" type="button" data-tour="report" data-tip="Отчёт и спецификация" onClick={onReport}>
            <IconDoc />
            <span className="ab-txt">Отчёт</span>
          </button>
        </div>
      </div>
    </header>
  );
}
