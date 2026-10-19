import type { Fix } from '../core/fixes';
import { IconBolt } from './Icons';

export function FixBar({ fix, onApply }: { fix: Fix; onApply: () => void }) {
  return (
    <div className="fixbar" role="note">
      <IconBolt />
      <span>{fix.text}</span>
      {fix.act && fix.label && <button className="btn sm primary" type="button" onClick={onApply}>{fix.label}</button>}
    </div>
  );
}
