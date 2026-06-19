type Listener = (state: boolean) => void;

let hasUnsavedChanges = false;
const listeners = new Set<Listener>();

export const idleStore = {
  get hasUnsavedChanges() {
    return hasUnsavedChanges;
  },
  setHasUnsavedChanges(val: boolean) {
    if (hasUnsavedChanges !== val) {
      hasUnsavedChanges = val;
      listeners.forEach((l) => l(hasUnsavedChanges));
    }
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
};

import { useState, useEffect } from "react";
export function useIdleStore() {
  const [state, setState] = useState(idleStore.hasUnsavedChanges);
  useEffect(() => {
    return idleStore.subscribe(setState);
  }, []);
  return {
    hasUnsavedChanges: state,
    setHasUnsavedChanges: idleStore.setHasUnsavedChanges
  };
}
