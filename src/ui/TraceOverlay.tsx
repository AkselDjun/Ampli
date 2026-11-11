import type { Trace } from '../core/types';
import { TRACE_GRID, tracePath } from '../core/traces';
import '../styles/traces.css';

export function TraceOverlay({ traces, cur = -1 }: { traces: Trace[]; cur?: number }) {
  return (
    <svg className="tr-svg" viewBox={'0 0 ' + TRACE_GRID + ' ' + TRACE_GRID} preserveAspectRatio="none" aria-hidden="true">
      {traces.map((t, i) => (
        <g key={i} className={'tr-g' + (i === cur ? ' cur' : '')}>
          <path className="tr-halo" d={tracePath(t)} />
          <path className="tr-line" d={tracePath(t)} />
        </g>
      ))}
    </svg>
  );
}

export function TraceNums({ traces }: { traces: Trace[] }) {
  return (
    <>
      {traces.map((t, i) => (
        <span key={i} className="tr-num" style={{ left: t.pts[0] / TRACE_GRID * 100 + '%', top: t.pts[1] / TRACE_GRID * 100 + '%' }}>{i + 1}</span>
      ))}
    </>
  );
}
