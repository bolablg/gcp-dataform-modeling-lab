/**
 * Date Filter Utilities Module
 * Handles date filtering logic for incremental data processing
 */

class DateFilter {

    /**
     * Generate date filter condition based on configuration
     * @param {string} dateColumn - Column name to filter on (default: 'updated_at')
     * @param {boolean} useVariable - Whether to use declared variables (default: true)
     * @param {boolean} fullRefresh - Whether this is a full refresh (default: false)
     * @param {number} begin_daysBack - Days back for begin date (for inline calculation)
     * @param {number} end_daysBack - Days back for end date (for inline calculation)
     * @returns {string} Date filter SQL condition
     */
    static generate(dateColumn = 'updated_at', useVariable = true, fullRefresh = false, begin_daysBack = 2, end_daysBack = 0) {
        if (fullRefresh) {
            return '1=1'; // No date filtering for full refresh
        }

        if (useVariable) {
            // For smart incremental: use inline date calculations to avoid variable scope issues in EXECUTE IMMEDIATE
            return `DATE(${dateColumn}) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL ${begin_daysBack} DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL ${end_daysBack} DAY)`;
        } else {
            return `DATE(${dateColumn}) >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY)`;
        }
    }

    /**
     * Generate date filter with custom days back
     * @param {string} dateColumn - Column name to filter on
     * @param {number} daysBack - Number of days to look back
     * @returns {string} Date filter SQL condition
     */
    static generateWithDaysBack(dateColumn, daysBack = 2) {
        return `DATE(${dateColumn}) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${daysBack} DAY)`;
    }

    /**
     * Generate date range filter
     * @param {string} dateColumn - Column name to filter on
     * @param {string} startDate - Start date (YYYY-MM-DD format or SQL function)
     * @param {string} endDate - End date (YYYY-MM-DD format or SQL function)
     * @returns {string} Date range filter SQL condition
     */
    static generateDateRange(dateColumn, startDate, endDate) {
        return `DATE(${dateColumn}) BETWEEN DATE('${startDate}') AND DATE('${endDate}')`;
    }

    /**
     * Generate timestamp filter (more precise than date filter)
     * @param {string} timestampColumn - Timestamp column name to filter on
     * @param {boolean} useVariable - Whether to use declared variables
     * @param {boolean} fullRefresh - Whether this is a full refresh
     * @param {number} hoursBack - Hours to look back if not using variables
     * @returns {string} Timestamp filter SQL condition
     */
    static generateTimestampFilter(timestampColumn = 'updated_at', useVariable = true, fullRefresh = false, hoursBack = 48) {
        if (fullRefresh) {
            return '1=1'; // No filtering for full refresh
        }

        if (useVariable) {
            // Use beginDate/limitDate variables but with timestamp precision
            return `${timestampColumn} BETWEEN TIMESTAMP(beginDate) AND TIMESTAMP_ADD(TIMESTAMP(limitDate), INTERVAL 1 DAY)`;
        } else {
            return `${timestampColumn} >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${hoursBack} HOUR)`;
        }
    }

    /**
     * Generate partition-aware date filter
     * @param {string} dateColumn - Column name to filter on
     * @param {string} partitionColumn - Partition column name
     * @param {boolean} useVariable - Whether to use declared variables
     * @param {boolean} fullRefresh - Whether this is a full refresh
     * @returns {string} Partition-aware date filter SQL condition
     */
    static generatePartitionAware(dateColumn = 'updated_at', partitionColumn = null, useVariable = true, fullRefresh = false) {
        const baseFilter = this.generate(dateColumn, useVariable, fullRefresh);

        if (!partitionColumn || fullRefresh) {
            return baseFilter;
        }

        // Add partition filter for better performance
        const partitionFilter = useVariable
            ? `${partitionColumn} BETWEEN beginDate AND limitDate`
            : `${partitionColumn} >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY)`;

        return `${baseFilter} AND ${partitionFilter}`;
    }

    /**
     * Generate variable declarations for date filtering
     * @param {number} beginDaysBack - Days back for begin date
     * @param {number} endDaysBack - Days back for end date
     * @returns {Array} Array of SQL variable declaration strings
     */
    static generateVariableDeclarations(beginDaysBack = 2, endDaysBack = 0) {
        return [
            `DECLARE beginDate DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL ${beginDaysBack} DAY);`,
            `DECLARE limitDate DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL ${endDaysBack} DAY);`
        ];
    }
}

module.exports = { DateFilter };