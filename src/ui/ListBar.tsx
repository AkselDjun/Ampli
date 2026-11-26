import type { ListFilter, ListSort } from '../core/listview';
import { IconSort } from './Icons';
import { MenuButton } from './MenuButton';

const SORTS: [ListSort, string][] = [
  ['no', 'По номеру'],
  ['p', 'По мощности'],
  ['i', 'По току'],
  ['du', 'По потере напряжения']
];

export interface ChipDef {
  id: ListFilter;
  label: string;
  n: number;
}

export function ListBar({ chips, filter, onFilter, sort, onSort, onPick, renumber }: {
  chips: ChipDef[];
  filter: ListFilter | null;
  onFilter: (f: ListFilter | null) => void;
  sort: ListSort;
  onSort: (s: ListSort) => void;
  onPick: () => void;
  renumber?: () => void;
}) {
  const shown = chips.filter(c => c.n > 0 || c.id === filter);
  return (
    <div className="ltb" role="toolbar" aria-label="Отбор и порядок групп">
      {shown.length > 0 && (
        <div className="ltb-chips" role="group" aria-label="Показать только">
          {shown.map(c => (
            <button key={c.id} type="button" className={'qf qf-' + c.id} aria-pressed={filter === c.id} onClick={() => onFilter(filter === c.id ? null : c.id)}>
              <i aria-hidden="true" />
              {c.label}
              <b>{c.n}</b>
            </button>
          ))}
        </div>
      )}
      <MenuButton
        className={'ltb-b ltb-sort' + (sort !== 'no' ? ' on' : '')}
        label={'Порядок групп: ' + (SORTS.find(s => s[0] === sort)?.[1] ?? '').toLowerCase()}
        tip="Порядок в списке"
        trigger={<IconSort />}
        end
        groups={[
          { id: 'sort', title: 'Порядок в списке', items: SORTS.map(([k, label]) => ({ id: k, label, current: sort === k, run: () => onSort(k) })) },
          ...(renumber ? [{ id: 'renum', items: [{ id: 'renum', label: 'Номера по порядку', hint: 'Номера пойдут подряд по помещениям, как на щитке', run: renumber }] }] : [])
        ]}
      />
      <button type="button" className="ltb-b ltb-pick" onClick={onPick}>Выбрать</button>
    </div>
  );
}
