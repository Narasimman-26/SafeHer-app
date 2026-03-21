import { AbstractPowerSyncDatabase } from '@powersync/common';
import React from 'react';
export declare const PowerSyncContext: React.Context<AbstractPowerSyncDatabase>;
/**
 * Custom hook that provides access to the PowerSync context.
 * @returns The PowerSync Database instance.
 * @example
 * const Component = () => {
 *   const db = usePowerSync();
 *   const [lists, setLists] = React.useState([]);
 *
 *   React.useEffect(() => {
 *     powersync.getAll('SELECT * from lists').then(setLists)
 *   }, []);
 *
 *   return <ul>
 *     {lists.map(list => <li key={list.id}>{list.name}</li>)}
 *   </ul>
 * };
 */
export declare const usePowerSync: () => AbstractPowerSyncDatabase;
