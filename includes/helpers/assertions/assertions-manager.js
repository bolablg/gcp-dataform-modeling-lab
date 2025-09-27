/**
 * Assertions Manager - Central Coordinator
 * Orchestrates data quality and business rules assertions
 */

const { DataQualityAssertions } = require('./data-quality-assertions.js');
const { BusinessRulesAssertions } = require('./business-rules-assertions.js');

class AssertionsManager {

    /**
     * Generate all assertions for a table based on configuration
     * @param {string} target - Target table name
     * @param {object} factoryConfig - Factory configuration object
     * @param {object} modelResult - Result from the model creation (contains metadata)
     * @param {object} currentModelContext - Current model context for fullRefresh state
     */
    static generateAssertions(target, factoryConfig, modelResult, currentModelContext) {
        if (!factoryConfig.assertions) {
            return; // No assertions configured
        }

        // Parse table information for assertion setup
        const tableInfo = this._parseTableInfo(target, factoryConfig);

        // Generate data quality assertions (now using views from configured assertion dataset)
        if (factoryConfig.assertions.data_quality) {
            DataQualityAssertions.generateDataQualityAssertions(
                tableInfo.tableIdForName,
                tableInfo.dataset,
                tableInfo.table,
                factoryConfig.assertions.data_quality
            );
        }

        // Generate business rules assertions (now using views from configured assertion dataset)
        if (factoryConfig.assertions.business_rules) {
            BusinessRulesAssertions.generateBusinessRulesAssertions(
                tableInfo.tableIdForName,
                tableInfo.dataset,
                tableInfo.table,
                factoryConfig.assertions.business_rules
            );
        }
    }

    /**
     * Parse table information from target and config
     * @private
     */
    static _parseTableInfo(target, factoryConfig) {
        // Parse table name to extract dataset and table for ref() calls
        const cleanTarget = target.replace(/[`"']/g, '');
        const tableParts = cleanTarget.split('.');
        const dataset = tableParts.length > 2 ? tableParts[1] : tableParts[0];
        const table = tableParts.length > 2 ? tableParts[2] : tableParts[1] || tableParts[0];
        const tableIdForName = `${dataset}_${table}`;

        // Build full table reference for assertions
        const fullTableRef = tableParts.length > 2 ? target : `\`your-project-id.${dataset}.${table}\``;
        const tableRefForAssertions = fullTableRef.replace(/[`]/g, ''); // Remove backticks for clean reference

        // Get unique keys for focused SELECT statements
        const uniqueKeys = factoryConfig.uniqueKeys || ['ID']; // Default fallback
        const uniqueKeysList = Array.isArray(uniqueKeys) ? uniqueKeys.join(', ') : uniqueKeys;

        // Get custom assertion columns or fallback to unique keys
        const assertionColumns = factoryConfig.assertions.columns || uniqueKeys;
        const assertionColumnsList = Array.isArray(assertionColumns) ? assertionColumns.join(', ') : assertionColumns;

        return {
            dataset,
            table,
            tableIdForName,
            tableRefForAssertions,
            uniqueKeys,
            uniqueKeysList,
            assertionColumns,
            assertionColumnsList
        };
    }


    /**
     * Validate assertion configuration before processing
     * @param {object} assertions - Assertions configuration
     * @returns {object} Validation result with errors if any
     */
    static validateAssertionConfig(assertions) {
        const errors = [];

        if (assertions.data_quality) {
            assertions.data_quality.forEach((check, index) => {
                if (!check.type) {
                    errors.push(`Data quality check at index ${index} missing 'type' property`);
                }

                switch (check.type) {
                    case 'not_null':
                        if (!check.column && !check.columns) {
                            errors.push(`Data quality not_null check at index ${index} missing 'column' or 'columns' property`);
                        }
                        break;
                    case 'unique_key':
                        if (!check.columns) {
                            errors.push(`Data quality unique_key check at index ${index} missing 'columns' property`);
                        }
                        break;
                    case 'accepted_values':
                        if (!check.column || !check.values) {
                            errors.push(`Data quality accepted_values check at index ${index} missing 'column' or 'values' property`);
                        }
                        break;
                    case 'relationships':
                        if (!check.column || !check.refTable || !check.refColumn) {
                            errors.push(`Data quality relationships check at index ${index} missing required properties`);
                        }
                        break;
                }
            });
        }

        if (assertions.business_rules) {
            assertions.business_rules.forEach((check, index) => {
                if (!check.type) {
                    errors.push(`Business rules check at index ${index} missing 'type' property`);
                }

                switch (check.type) {
                    case 'freshness':
                        if (!check.dateColumn) {
                            errors.push(`Business rules freshness check at index ${index} missing 'dateColumn' property`);
                        }
                        break;
                    case 'row_count':
                        if (check.minRows === undefined && check.maxRows === undefined) {
                            errors.push(`Business rules row_count check at index ${index} missing 'minRows' or 'maxRows' property`);
                        }
                        break;
                    case 'percentage':
                        if (!check.condition || check.percentage === undefined) {
                            errors.push(`Business rules percentage check at index ${index} missing 'condition' or 'percentage' property`);
                        }
                        break;
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = { AssertionsManager };