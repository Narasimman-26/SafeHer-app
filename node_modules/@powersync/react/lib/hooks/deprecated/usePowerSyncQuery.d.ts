/**
 * @deprecated use {@link useQuery} instead.
 *
 * A hook to access a single static query.
 * For an updated result, use {@link usePowerSyncWatchedQuery} instead.
 */
export declare const usePowerSyncQuery: <T = any>(sqlStatement: string, parameters?: any[]) => T[];
