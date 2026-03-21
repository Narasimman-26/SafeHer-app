import { AbstractPowerSyncDatabaseOpenFactory } from '@powersync/common';
import { PowerSyncDatabase } from '../../../db/PowerSyncDatabase';
import { ReactNativeQuickSqliteOpenFactory } from './ReactNativeQuickSQLiteOpenFactory';
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
export class RNQSPowerSyncDatabaseOpenFactory extends AbstractPowerSyncDatabaseOpenFactory {
    instanceGenerated;
    sqlOpenFactory;
    constructor(options) {
        super(options);
        this.instanceGenerated = false;
        this.sqlOpenFactory = new ReactNativeQuickSqliteOpenFactory(options);
    }
    openDB() {
        return this.sqlOpenFactory.openDB();
    }
    generateInstance(options) {
        if (this.instanceGenerated) {
            this.options.logger?.warn('Generating multiple PowerSync instances can sometimes cause unexpected results.');
        }
        this.instanceGenerated = true;
        return new PowerSyncDatabase(options);
    }
}
//# sourceMappingURL=RNQSDBOpenFactory.js.map