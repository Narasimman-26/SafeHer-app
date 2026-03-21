/**
 * @deprecated Use {@link useStatus} instead.
 *
 * Custom hook that provides access to the current status of PowerSync.
 * @returns The PowerSync Database status.
 * @example
 * const Component = () => {
 *   const status = usePowerSyncStatus();
 *
 *   return <div>
 *     status.connected ? 'wifi' : 'wifi-off'
 *   </div>
 * };
 */
export declare const usePowerSyncStatus: () => import("@powersync/common").SyncStatus;
