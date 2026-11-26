import type { Fix } from '../core/fixes';
import { IconStBad, IconStWarn } from './Icons';
import { Button } from './kit';

export function FixBar({ fix, onApply, bad = false }: { fix: Fix; onApply: () => void; bad?: boolean }) {
  return (
    <div className={'fixbar ' + (bad ? 'bad' : 'warn')} role="note">
      {bad ? <IconStBad /> : <IconStWarn />}
      <div className="fixbar-t">
        <span>{fix.text}</span>
        {fix.act && fix.label && <Button variant="primary" size="sm" onClick={onApply}>{fix.label}</Button>}
      </div>
    </div>
  );
}
