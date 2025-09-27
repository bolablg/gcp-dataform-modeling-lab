/**
 * Business Rules Assertions Module
 * Handles all business rule checks: freshness, row_count, percentage thresholds
 */

const { WorkflowConfig } = require('../utilities/workflow-config.js');

class BusinessRulesAssertions {

    /**
     * Generate all business rules assertions for a table (now using pre-built views)
     * @param {string} tableIdForName - Table identifier for assertion naming
     * @param {string} dataset - Dataset name for dependencies
     * @param {string} table - Table name for dependencies
     * @param {Array} businessRulesChecks - Array of business rules check definitions
     */
    static generateBusinessRulesAssertions(
        tableIdForName,
        dataset,
        table,
        businessRulesChecks
    ) {
        // Group checks by type for efficiency
        const businessRulesByType = businessRulesChecks.reduce((acc, check) => {
            if (!acc[check.type]) {
                acc[check.type] = [];
            }
            acc[check.type].push(check);
            return acc;
        }, {});

        // Create one assertion per type - now simply querying the pre-built views
        Object.keys(businessRulesByType).forEach(type => {
            const assertionName = `${tableIdForName}_business_rules_${type}`;
            const assertionDataset = WorkflowConfig.getAssertionDataset(dataset);
            const viewName = `${assertionDataset}.${tableIdForName}_business_rules_${type}_build`;

            // Simple assertion that just queries the view - all complexity is in the view!
            assert(assertionName)
                .dependencies([{schema: dataset, name: table}])
                .query(() => `SELECT * FROM \`${viewName}\``);
        });
    }

}

module.exports = { BusinessRulesAssertions };