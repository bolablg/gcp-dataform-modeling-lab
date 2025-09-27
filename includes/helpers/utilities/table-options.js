/**
 * Table Options Builder Module
 * Handles partition, cluster, and other table options for BigQuery
 */

class TableOptions {

    /**
     * Build table options string from configuration
     * @param {object} config - Configuration object
     * @returns {string} Formatted table options string
     */
    static build(config) {
        const options = [];

        if (config.partitionBy) {
            options.push(`PARTITION BY ${config.partitionBy}`);
        }

        if (config.clusterBy && config.clusterBy.length > 0) {
            options.push(`CLUSTER BY ${config.clusterBy.join(', ')}`);
        }

        return options.length > 0 ? '\n' + options.join('\n') : '';
    }

    /**
     * Build partition clause specifically
     * @param {string} partitionColumn - Column to partition by
     * @returns {string} Partition clause
     */
    static buildPartitionClause(partitionColumn) {
        if (!partitionColumn) return '';
        return `PARTITION BY ${partitionColumn}`;
    }

    /**
     * Build cluster clause specifically
     * @param {Array} clusterColumns - Columns to cluster by
     * @returns {string} Cluster clause
     */
    static buildClusterClause(clusterColumns) {
        if (!clusterColumns || clusterColumns.length === 0) return '';
        return `CLUSTER BY ${clusterColumns.join(', ')}`;
    }

    /**
     * Build table description options
     * @param {string} description - Table description
     * @returns {string} Description options clause
     */
    static buildDescriptionOptions(description) {
        if (!description) return '';
        return `\nOPTIONS(description="${description}")`;
    }

    /**
     * Build expiration options for temporary tables
     * @param {number} hours - Hours until expiration
     * @returns {string} Expiration options clause
     */
    static buildExpirationOptions(hours = 12) {
        return `\nOPTIONS(\n  expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL ${hours} HOUR)\n)`;
    }

    /**
     * Build combined options for complex table configurations
     * @param {object} config - Full configuration object
     * @returns {object} Separated options object
     */
    static buildAdvancedOptions(config) {
        return {
            tableOptions: this.build(config),
            description: this.buildDescriptionOptions(config.description),
            expiration: config.temporary ? this.buildExpirationOptions(config.expirationHours) : ''
        };
    }
}

module.exports = { TableOptions };