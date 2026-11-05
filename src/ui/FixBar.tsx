import type { Fix } from '../core/fixes';
import { IconBolt } from './Icons';
import { Button } from './kit';

export function FixBar({ fix, onApply }: { fix: Fix; onApply: () => void }) {
  return (
    <div className="fixbar" role="note">
      <IconBolt />
      <span>{fix.text}</span>
      {fix.act && fix.label && <Button variant="primary" size="sm" onClick={onApply}>{fix.label}</Button>}
    </div>
  );
}
