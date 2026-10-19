export type LineType = 'light' | 'socket' | 'power';
export type Phase = 'L1' | 'L2' | 'L3' | '3';
export type Status = 'ok' | 'warn' | 'bad';
export type Num = number | string;

export interface App {
  id: string;
  name: string;
  w: Num;
  n: Num;
}

export interface RoomApp {
  id: string;
  name: string;
  w: Num;
  n: Num;
  tag: 'l' | 's' | 'p';
}

export interface Room {
  id: string;
  name: string;
  kitchen?: boolean;
  apps: RoomApp[];
}

export interface Meas {
  zs?: Num;
  ins?: Num;
  leak?: Num;
}

export type PhotoTag = 'before' | 'after' | 'plate' | 'meas';

export interface Photo {
  id: string;
  tag: PhotoTag;
  line: string;
  note: string;
  at: number;
}

export interface Proto {
  date: string;
  device: string;
  by: string;
}

export interface Line {
  id: string;
  name: string;
  where?: string;
  type: LineType;
  phase: Phase;
  wet?: boolean;
  meas?: Meas;
  len: Num;
  kc: Num;
  cos: Num;
  apps: App[];
}

export interface Cfg {
  supply: Num;
  method: string;
  drop: Num;
  ko: Num;
  k: Num;
  alloc: Num;
  minS: string;
  zs: Num;
  feeder: Num;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  client: string;
  author: string;
  created: number;
  updated: number;
  sample: boolean;
  cfg: Cfg;
  lines: Line[];
  checks?: Record<string, boolean>;
  proto?: Proto;
  rooms?: Room[];
  photos?: Photo[];
}

export interface Content {
  sample: boolean;
  cfg: Cfg;
  lines: Line[];
}

export interface CfgN {
  supply: 1 | 3;
  method: 'wall' | 'open';
  drop: number;
  ko: number;
  k: number;
  alloc: number;
  safe: boolean;
  zs: number;
  feeder: number;
}

export interface LineResult {
  limit: number;
  pInst: number;
  pd: number;
  I: number;
  three: boolean;
  len: number;
  cos: number;
  kc: number;
  notes: string[];
  status: Status;
  rcd: boolean;
  ma: number;
  curve: string;
  In: number | null;
  S: number | null;
  drop: number;
  empty: boolean;
  mod: number;
  ik: number;
  ikNeed: number;
  ikSrc: 'calc' | 'meas';
  zsMeas: number | null;
  insMeas: number | null;
  leakMeas: number | null;
  leakLim: number;
  leakEst: number;
}

export interface Device {
  kind: 'in' | 'rcd' | 'mcb';
  mod: number;
  label: string;
  sub: string;
  ma?: number;
  title: string;
}

export interface Row {
  l: Line;
  r: LineResult;
}

export interface Phases {
  L1: number;
  L2: number;
  L3: number;
}

export interface Calc {
  c: CfgN;
  rows: Row[];
  sumInst: number;
  P: number;
  Itot: number;
  phases: Phases | null;
  imb: number;
  inIn: number | null;
  inS: number | null;
  devs: Device[];
  modSum: number;
  size: number;
  placed: number;
  fits: boolean;
  issues: number;
  inStep: number;
  hint3: boolean;
}

export interface SpecItem {
  name: string;
  qty: string;
  note: string;
  n: number | null;
  unit: string;
}
