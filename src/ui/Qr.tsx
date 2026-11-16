import { qrShape } from '../core/qr';

export function Qr({ text, label, tooBig, className = 'qr' }: { text: string; label: string; tooBig?: string; className?: string }) {
  const s = qrShape(text);
  if (!s) return tooBig ? <p className="muted" role="status">{tooBig}</p> : null;
  return (
    <svg className={className} role="img" aria-label={label} viewBox={'0 0 ' + s.size + ' ' + s.size} shapeRendering="crispEdges">
      <rect width={s.size} height={s.size} className="qr-bg" />
      <path d={s.path} className="qr-ink" />
    </svg>
  );
}
