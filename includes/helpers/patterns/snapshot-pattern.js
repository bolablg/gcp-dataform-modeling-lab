/**
 * Snapshot Pattern Module
 * Handles full table refresh operations (CREATE OR REPLACE TABLE)
 */

const { TableOptions } = require('../utilities/table-options.js');
const { TableBuilder } = require('../core/table-builder.js');

class SnapshotPattern {

    /**
     * Generate snapshot pattern for full table refresh
     * @param {string} targetTable - Target table name
     * @param {object} config - Configuration object
     * @returns {object} Pattern result with preSQL and postSQL
     */
    static generate(targetTable, config = {}) {
        const tableOptions = TableOptions.build(config);
        const metadata = TableBuilder._buildTableMetadata(config);

        const preSQL = this._buildPreSQL(targetTable, tableOptions, metadata);
        const postSQL = this._buildPostSQL();

        return {
            preSQL: preSQL,
            postSQL: postSQL
        };
    }

    /**
     * Build preSQL section for snapshot pattern
     * @private
     */
    static _buildPreSQL(targetTable, tableOptions, metadata) {
        // Add DROP statement to handle partitioning/clustering conflicts
        const dropStatement = `DROP TABLE IF EXISTS ${targetTable};`;

        const createStatement = metadata
            ? `CREATE TABLE ${targetTable}${tableOptions}\n${metadata}`
            : `CREATE TABLE ${targetTable}${tableOptions}`;

        return `
/*
┌───────────────────────────────────────────────────────────────┐
│                  📸 SNAPSHOT PATTERN                    │
│ Mode: Full Table Refresh                               │
│ Generated: ${new Date().toISOString().split('T')[0].padEnd(37)} │
└───────────────────────────────────────────────────────────────┘
*/

-- 🔄 CLEANUP: Drop existing table to handle schema changes
${dropStatement}

-- 🏗️ CREATE: Build new table with current data
${createStatement}
AS (
      `
    }

    /**
     * Build postSQL section for snapshot pattern
     * @private
     */
    static _buildPostSQL() {
        return `
)

/*
┌───────────────────────────────────────────────────────────────┐
│ ✅ SNAPSHOT CREATION COMPLETE                         │
│ • Table fully refreshed with current data              │
└───────────────────────────────────────────────────────────────┘
*/
      `
    }
}

module.exports = { SnapshotPattern };