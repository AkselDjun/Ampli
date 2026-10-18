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

export interface Line {
  id: string;
  name: string;
  type: LineType;
  phase: Phase;
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
}

export interface SpecItem {
  name: string;
  qty: string;
  note: string;
}
