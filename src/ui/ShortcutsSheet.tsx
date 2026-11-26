import { HOTKEYS } from '../core/hotkeys';
import { Sheet } from './common';

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Горячие клавиши" kind="dialog">
      <p className="muted">Работают, когда курсор не стоит в поле ввода. Буквы узнаются в любой раскладке.</p>
      <dl className="keys">
        {HOTKEYS.map(h => (
          <div key={h.label} className="keys-r">
            <dt>{h.keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</dt>
            <dd>{h.label}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
