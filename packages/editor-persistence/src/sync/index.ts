// Placeholder exports for sync mechanisms
export const syncMechanisms = ['websocket', 'polling', 'offline', 'conflict-resolver'] as const;
export type SyncMechanism = typeof syncMechanisms[number];