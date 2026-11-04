import { createContext, useContext } from 'react';

export interface SheetNav {
  back?: () => void;
  to?: string;
}

export const SheetNavContext = createContext<SheetNav>({});
export const useSheetNav = (): SheetNav => useContext(SheetNavContext);
