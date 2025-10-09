const { IncrementalPattern } = require('../patterns/incremental-pattern.js');
const { SnapshotPattern } = require('../patterns/snapshot-pattern.js');
const { ViewPattern } = require('../patterns/view-pattern.js');
const { DateFilter } = require('./date-filter.js');
const { TableOptions } = require('./table-options.js');

// Store per-model contexts to avoid global state issues during compilation
const modelContexts = new Map();

/**
 * SQLXUtils - Pattern Coordinator
 * Delegates to specialized pattern modules for clean separation of concerns
 */
class SQLXUtils {

    /**
     * Store model-specific context
     */
    static setModelContext(targetTable, context) {
        modelContexts.set(targetTable, context);
    }

    /**
     * Get model-specific context
     */
    static getModelContext(targetTable) {
        return modelContexts.get(targetTable) || {};
    }

    /**
     * Generate incremental pattern with MERGE operations
     * @param {string} targetTable - Target table name
     * @param {Array|string} uniqueKeys - Unique key columns for MERGE
     * @param {object} config - Configuration object
     * @returns {object} Pattern result with preSQL, postSQL, and metadata
     */
    static incrementalPattern(targetTable, uniqueKeys = ['ID'], config = {}) {
        return IncrementalPattern.generate(targetTable, uniqueKeys, config);
    }

    /**
     * Generate snapshot pattern for full table refresh
     * @param {string} targetTable - Target table name
     * @param {object} config - Configuration object
     * @returns {object} Pattern result with preSQL and postSQL
     */
    static snapshotPattern(targetTable, config = {}) {
        return SnapshotPattern.generate(targetTable, config);
    }

    /**
     * Generate view pattern for real-time views
     * @param {string} viewName - Target view name
     * @param {object} config - Configuration object
     * @returns {object} Pattern result with preSQL and postSQL
     */
    static viewPattern(viewName, config = {}) {
        return ViewPattern.generate(viewName, config);
    }

    /**
     * Generate date filter condition
     * @param {string} dateColumn - Column name to filter on (default: 'updated_at')
     * @param {boolean} useVariable - Whether to use declared variables (default: true)
     * @param {boolean} fullRefresh - Whether this is a full refresh (default: false)
     * @returns {string} Date filter SQL condition
     */
    static dateFilter(dateColumn = 'updated_at', useVariable = true, fullRefresh = false, begin_daysBack = 2, end_daysBack = 0) {
        return DateFilter.generate(dateColumn, useVariable, fullRefresh, begin_daysBack, end_daysBack);
    }

    /**
     * Build table options string from configuration (legacy method)
     * @param {object} config - Configuration object
     * @returns {string} Formatted table options string
     * @deprecated Use TableOptions.build() directly instead
     */
    static _buildTableOptions(config) {
        return TableOptions.build(config);
    }

    // Extended functionality through pattern modules
    static get patterns() {
        return {
            incremental: IncrementalPattern,
            snapshot: SnapshotPattern,
            view: ViewPattern
        };
    }

    static get utilities() {
        return {
            dateFilter: DateFilter,
            tableOptions: TableOptions
        };
    }
}

module.exports = {
    SQLXUtils
};