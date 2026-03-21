import { SQLWatchOptions } from '@powersync/common';
/**
 * @deprecated use {@link useQuery} instead.
 *
 * A hook to access the results of a watched query.
 * @example
 * export const Component = () => {
 * const lists = usePowerSyncWatchedQuery('SELECT * from lists');
 *
 * return <View>
 *   {lists.map((l) => (
 *     <Text key={l.id}>{JSON.stringify(l)}</Text>
 *   ))}
 * </View>
 * }
 */
export declare const usePowerSyncWatchedQuery: <T = any>(sqlStatement: string, parameters?: any[], options?: Omit<SQLWatchOptions, "signal">) => T[];
