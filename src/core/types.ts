import type { WorkQty } from './labor';
import type { Weak, WeakCalc } from './weak';
import type { FloorRoom } from './floor';

export type LineType = 'light' | 'socket' | 'power';
export type Phase = 'L1' | 'L2' | 'L3' | '3';
export type Status = 'ok' | 'warn' | 'bad';
export type Num = number | string;
export type BoxType = 'brick' | 'gkl' | 'surface';
export type InCable = 'vvg' | 'frls' | 'nym';
export type AfddMode = 'off' | 'sock' | 'all';

export interface Appliance {
  id: string;
  name: string;
  w: Num;
  n: Num;
  br?: Num;
  m?: Num;
  cos?: Num;
  alt?: boolean;
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
  rcd?: Num;
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

export interface Acts {
  start: string;
  end: string;
  warranty: number;
}

export type OldSign = 'heat' | 'crumble' | 'twist' | 'trip';

export interface OldWiring {
  metal: 'cu' | 'al' | '';
  sec: number;
  pe: 'yes' | 'no' | 'jumper' | '';
  net: 'tncs' | 'tnc' | '';
  panel: 'fuse' | 'old' | 'mod' | '';
  ins: string;
  age: string;
  signs: OldSign[];
}

export interface Line {
  id: string;
  name: string;
  where?: string;
  type: LineType;
  phase: Phase;
  wet?: boolean;
  meas?: Meas;
  zone?: string;
  sockets?: Num;
  perSocket?: Num;
  len: Num;
  apps: Appliance[];
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
  prot?: string;
  box?: string;
  inCable?: string;
  spd?: string;
  vr?: string;
  afdd?: string;
  margin?: Num;
  grpCable?: string;
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
  work?: WorkQty;
  acts?: Acts;
  old?: OldWiring;
  weak?: Weak;
  floor?: FloorRoom[];
}

export interface Content {
  sample: boolean;
  cfg: Cfg;
  lines: Line[];
  floor?: FloorRoom[];
  weak?: Weak;
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
  rcdMode: boolean;
  box: BoxType;
  boxAuto: boolean;
  inCable: InCable;
  spd: boolean;
  vr: boolean;
  afdd: AfddMode;
  margin: number;
  grpCable: InCable;
}

export interface LineResult {
  limit: number;
  pInst: number;
  pd: number;
  I: number;
  three: boolean;
  len: number;
  cos: number;
  load: number;
  cab: string;
  notes: string[];
  tips: string[];
  status: Status;
  rcd: boolean;
  rcbo: boolean;
  rcdA: boolean;
  arc: boolean;
  zone: string;
  uzo: number | null;
  cable: number;
  sockets: number;
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
  rcdMeas: number | null;
  rcdLim: number;
  leakLim: number;
  leakEst: number;
}

export interface Device {
  kind: 'in' | 'rcd' | 'uzo' | 'mcb' | 'spd' | 'vr';
  mod: number;
  label: string;
  sub: string;
  ma?: number;
  title: string;
  lid?: string;
  zone?: string;
  ph?: Phase;
  st?: Status;
  arc?: boolean;
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

export interface Uzo {
  zone: string;
  In: number;
  ma: number;
  four: boolean;
  typeA: boolean;
  groups: number[];
  leak: number;
  sumIn: number;
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
  uzos: Uzo[];
  boxes: number;
  weak?: WeakCalc;
  floor?: FloorRoom[];
}

export interface SpecItem {
  name: string;
  qty: string;
  note: string;
  n: number | null;
  unit: string;
}
