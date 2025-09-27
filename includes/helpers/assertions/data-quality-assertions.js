/**
 * Data Quality Assertions Module
 * Handles all data quality checks: not_null, unique_key, accepted_values, relationships
 */

const { WorkflowConfig } = require('../utilities/workflow-config.js');

class DataQualityAssertions {

    /**
     * Generate all data quality assertions for a table (now using pre-built views)
     * @param {string} tableIdForName - Table identifier for assertion naming
     * @param {string} dataset - Dataset name for dependencies
     * @param {string} table - Table name for dependencies
     * @param {Array} dataQualityChecks - Array of data quality check definitions
     */
    static generateDataQualityAssertions(
        tableIdForName,
        dataset,
        table,
        dataQualityChecks
    ) {
        // Group checks by type for efficiency
        const dataQualityByType = dataQualityChecks.reduce((acc, check) => {
            if (!acc[check.type]) {
                acc[check.type] = [];
            }
            acc[check.type].push(check);
            return acc;
        }, {});

        // Create one assertion per type - now simply querying the pre-built views
        Object.keys(dataQualityByType).forEach(type => {
            const assertionName = `${tableIdForName}_data_quality_${type}`;
            const assertionDataset = WorkflowConfig.getAssertionDataset(dataset);
            const viewName = `${assertionDataset}.${tableIdForName}_data_quality_${type}_build`;

            // Simple assertion that just queries the view - all complexity is in the view!
            assert(assertionName)
                .dependencies([{schema: dataset, name: table}])
                .query(() => `SELECT * FROM \`${viewName}\``);
        });
    }

}

module.exports = { DataQualityAssertions };