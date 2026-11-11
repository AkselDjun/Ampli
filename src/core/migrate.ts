export const SCHEMA = 2;

type Raw = Record<string, unknown>;

const isRaw = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

export function schemaOf(o: unknown): number {
  const s = isRaw(o) ? o.schema : undefined;
  return typeof s === 'number' && Number.isInteger(s) && s >= 1 ? s : 1;
}

function v1to2(p: Raw): Raw {
  if (!Array.isArray(p.lines)) return p;
  const rcd = isRaw(p.cfg) && p.cfg.prot === 'rcd';
  const lines = p.lines.map(l => {
    if (!isRaw(l)) return l;
    const { where, kc, cos, ...rest } = l;
    void kc;
    void cos;
    const own = typeof rest.zone === 'string' && rest.zone.trim() ? rest.zone : '';
    const w = typeof where === 'string' ? where.trim() : '';
    return own || rcd || !w ? rest : { ...rest, zone: w.slice(0, 60) };
  });
  return { ...p, lines };
}

const STEPS: ((p: Raw) => Raw)[] = [v1to2];

export const needsMigration = (o: unknown): boolean => isRaw(o) && schemaOf(o) < SCHEMA;

export function migrate(o: unknown): unknown {
  if (!isRaw(o)) return o;
  let p: Raw = o;
  for (let v = schemaOf(o); v < SCHEMA; v++) p = STEPS[v - 1](p);
  return p;
}
