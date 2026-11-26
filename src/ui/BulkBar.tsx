import { NO_ZONE } from '../core/zonelist';
import '../styles/bulk.css';
import { ArmButton } from './common';
import { IconCopy, IconMove } from './Icons';
import { Button } from './kit';
import { MenuButton } from './MenuButton';

export function BulkBar({ n, zones, onZone, onCopy, onDelete, onDone }: {
  n: number;
  zones: string[];
  onZone: (zone: string) => void;
  onCopy: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  return (
    <div className="ltb bulk" role="toolbar" aria-label="Действия с выбранными группами">
      <span className="bulk-n" aria-live="polite">Выбрано: {n}</span>
      <MenuButton
        className="ltb-b"
        label="Перенести в помещение"
        tip="В помещение"
        trigger={<><IconMove /><span className="ltb-t">В помещение</span></>}
        groups={[{ id: 'zones', title: 'Перенести в помещение', items: [...zones, NO_ZONE].map(z => ({ id: z, label: z, run: () => onZone(z === NO_ZONE ? '' : z) })) }]}
      />
      <button type="button" className="ltb-b" aria-label="Копировать выбранные" data-tip="Копировать" disabled={!n} onClick={onCopy}><IconCopy /><span className="ltb-t">Копировать</span></button>
      <ArmButton className="ltb-del" variant="danger" size="sm" label="Удалить" armedLabel={'Удалить ' + n + '?'} disabled={!n} onRun={onDelete} />
      <Button size="sm" variant="ghost" className="bulk-done" onClick={onDone}>Готово</Button>
    </div>
  );
}
