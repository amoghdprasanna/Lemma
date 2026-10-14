import { createContext, useContext, useSyncExternalStore } from 'react';
import type { PanelController, PanelState } from './controller/controller';

export const ControllerContext = createContext<PanelController | null>(null);

export function useController(): PanelController {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('ControllerContext missing');
  return c;
}

export function usePanelState(): PanelState {
  const c = useController();
  return useSyncExternalStore(c.subscribe, c.getState);
}
