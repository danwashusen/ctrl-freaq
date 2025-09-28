export type StateUpdater<TState> =
  | TState
  | Partial<TState>
  | ((state: TState) => TState | Partial<TState>);

export interface StoreApi<TState> {
  setState: (partial: StateUpdater<TState>, replace?: boolean) => void;
  getState: () => TState;
  subscribe: (listener: (state: TState) => void) => () => void;
}

export type StateInitializer<TState> = (
  set: (partial: StateUpdater<TState>, replace?: boolean) => void,
  get: () => TState,
  api: StoreApi<TState>
) => TState;

export interface UseStore<TState> {
  <TSelected = TState>(selector?: (state: TState) => TSelected): TSelected;
  getState: () => TState;
  setState: (partial: StateUpdater<TState>) => void;
  subscribe: (listener: (state: TState) => void) => () => void;
}

function initializeStore<TState>(initializer: StateInitializer<TState>): UseStore<TState> {
  let state: TState;
  const listeners = new Set<(value: TState) => void>();

  const subscribe = (listener: (value: TState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const store: StoreApi<TState> = {
    setState: (partial, replace = false) => {
      const nextValue =
        typeof partial === 'function'
          ? (partial as (value: TState) => TState | Partial<TState>)(state)
          : partial;

      state = replace
        ? (nextValue as TState)
        : {
            ...state,
            ...(nextValue as Partial<TState>),
          };

      listeners.forEach(listener => listener(state));
    },
    getState: () => state,
    subscribe,
  };

  const set = (partial: StateUpdater<TState>, replace?: boolean) =>
    store.setState(partial, replace);

  state = initializer(set, store.getState, store);

  const useStore = (<TSelected = TState>(
    selector: (value: TState) => TSelected = value => value as unknown as TSelected
  ) => selector(state)) as UseStore<TState>;

  useStore.getState = store.getState;
  useStore.setState = partial => store.setState(partial);
  useStore.subscribe = store.subscribe;

  return useStore;
}

export const create = <TState>(
  initializer?: StateInitializer<TState>
): UseStore<TState> | ((initializer: StateInitializer<TState>) => UseStore<TState>) => {
  if (initializer) {
    return initializeStore(initializer);
  }

  return (nextInitializer: StateInitializer<TState>) => initializeStore(nextInitializer);
};
