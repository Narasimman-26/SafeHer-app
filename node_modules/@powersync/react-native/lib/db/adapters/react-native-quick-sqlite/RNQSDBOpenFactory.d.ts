import { AbstractPowerSyncDatabase, AbstractPowerSyncDatabaseOpenFactory, DBAdapter, PowerSyncDatabaseOptions, PowerSyncOpenFactoryOptions, SQLOpenFactory } from '@powersync/common';
/**
 * @deprecated {@link PowerSyncDatabase} can now be constructed directly
 * @example
 * ```typescript
 * const powersync = new PowerSyncDatabase({
 *  database: {
 *    dbFileName: 'powersync.db'
 *  }
 * });
 * ```
 */
export declare class RNQSPowerSyncDatabaseOpenFactory extends AbstractPowerSyncDatabaseOpenFactory {
    protected instanceGenerated: boolean;
    protected sqlOpenFactory: SQLOpenFactory;
    constructor(options: PowerSyncOpenFactoryOptions);
    protected openDB(): DBAdapter;
    generateInstance(options: PowerSyncDatabaseOptions): AbstractPowerSyncDatabase;
}
