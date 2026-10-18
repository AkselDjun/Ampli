import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import { emptyLib } from './lib';
import type { Lib, LibAction } from './lib';

export interface LibCtx {
  lib: Lib;
  dispatch: Dispatch<LibAction>;
}

export const LibContext = createContext<LibCtx>({ lib: emptyLib(), dispatch: () => undefined });
export const useLib = (): LibCtx => useContext(LibContext);
