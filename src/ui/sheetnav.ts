import { createContext, useContext } from 'react';
import type { SheetNav } from '../app/types';

export const SheetNavContext = createContext<SheetNav>({});
export const useSheetNav = (): SheetNav => useContext(SheetNavContext);
