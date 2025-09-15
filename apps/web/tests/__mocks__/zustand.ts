export type StateInitializer<TState> = (
  set: (partial: StateUpdater<TState>) => void,
  get: () => TState
) => TState;

export type StateUpdater<TState> =
  | TState
  | Partial<TState>
  | ((state: TState) => TState | Partial<TState>);

export interface UseStore<TState> {
  <TSelected = TState>(selector?: (state: TState) => TSelected): TSelected;
  getState: () => TState;
  setState: (partial: StateUpdater<TState>) => void;
  subscribe: (listener: (state: TState) => void) => () => void;
}

export const create = <TState>(initializer: StateInitializer<TState>) => {
  let state: TState;
  const listeners = new Set<(value: TState) => void>();

  const setState = (partial: StateUpdater<TState>) => {
    const next =
      typeof partial === 'function'
        ? (partial as (value: TState) => TState | Partial<TState>)(state)
        : partial;
    state = {
      ...state,
      ...(next as Partial<TState>),
    };
    listeners.forEach(listener => listener(state));
  };

  const getState = () => state;

  state = initializer(setState, getState);

  const useStore = (<TSelected = TState>(
    selector: (value: TState) => TSelected = value => value as unknown as TSelected
  ) => selector(state)) as UseStore<TState>;

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = (listener: (value: TState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return useStore;
};
