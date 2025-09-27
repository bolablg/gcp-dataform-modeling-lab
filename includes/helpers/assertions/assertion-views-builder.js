/**
 * Assertion Views Builder Module
 * Creates views in the same dataset as assertions (configured in workflow_settings.yaml)
 */

const { WorkflowConfig } = require('../utilities/workflow-config.js');

class AssertionViewsBuilder {

    /**
     * Generate assertion views for a table during model compilation
     * @param {string} target - Target table name
     * @param {object} factoryConfig - Factory configuration object
     * @param {object} modelResult - Result from the model creation (contains metadata)
     * @param {object} currentModelContext - Current model context for fullRefresh state
     * @returns {string} SQL for creating assertion views
     */
    static generateAssertionViews(target, factoryConfig, modelResult, currentModelContext) {
        if (!factoryConfig.assertions) {
            return ''; // No assertions configured
        }

        const tableInfo = this._parseTableInfo(target, factoryConfig);
        const assertionDataset = WorkflowConfig.getAssertionDataset(tableInfo.dataset);
        const partitionFilter = this._buildPartitionFilter(
            factoryConfig,
            modelResult.metadata,
            currentModelContext
        );

        let viewsSQL = '';

        // Generate data quality assertion views
        if (factoryConfig.assertions.data_quality) {
            viewsSQL += this._generateDataQualityViews(
                tableInfo,
                assertionDataset,
                factoryConfig.assertions.data_quality,
                partitionFilter
            );
        }

        // Generate business rules assertion views
        if (factoryConfig.assertions.business_rules) {
            viewsSQL += this._generateBusinessRulesViews(
                tableInfo,
                assertionDataset,
                factoryConfig.assertions.business_rules,
                partitionFilter
            );
        }

        return viewsSQL;
    }

    /**
     * Generate data quality assertion views
     * @private
     */
    static _generateDataQualityViews(tableInfo, assertionDataset, dataQualityChecks, partitionFilter) {
        // Group checks by type for efficiency
        const dataQualityByType = dataQualityChecks.reduce((acc, check) => {
            if (!acc[check.type]) {
                acc[check.type] = [];
            }
            acc[check.type].push(check);
            return acc;
        }, {});

        let viewsSQL = '';

        Object.keys(dataQualityByType).forEach(type => {
            const checks = dataQualityByType[type];
            const viewName = `${assertionDataset}.${tableInfo.tableIdForName}_data_quality_${type}_build`;
            const queries = [];

            checks.forEach(check => {
                switch (type) {
                    case 'not_null':
                        queries.push(...this._generateNotNullViewQueries(check, tableInfo, partitionFilter));
                        break;
                    case 'unique_key':
                        queries.push(...this._generateUniqueKeyViewQueries(check, tableInfo, partitionFilter));
                        break;
                    case 'accepted_values':
                        queries.push(...this._generateAcceptedValuesViewQueries(check, tableInfo, partitionFilter));
                        break;
                    case 'relationships':
                        queries.push(...this._generateRelationshipViewQueries(check, tableInfo, partitionFilter));
                        break;
                }
            });

            if (queries.length > 0) {
                const unionQuery = queries.join('\nUNION ALL\n');
                // Use CONCAT to build the query string with partition_values embedded
                viewsSQL += `
-- 📊 DATA QUALITY: Create ${type} assertion view with partition filtering
EXECUTE IMMEDIATE CONCAT("""
    CREATE OR REPLACE VIEW \`${viewName}\` AS
    """, REPLACE("""${unionQuery}""", "partition_values", partition_values));
`;
            }
        });

        return viewsSQL;
    }

    /**
     * Generate business rules assertion views
     * @private
     */
    static _generateBusinessRulesViews(tableInfo, assertionDataset, businessRulesChecks, partitionFilter) {
        const businessRulesByType = businessRulesChecks.reduce((acc, check) => {
            if (!acc[check.type]) {
                acc[check.type] = [];
            }
            acc[check.type].push(check);
            return acc;
        }, {});

        let viewsSQL = '';

        Object.keys(businessRulesByType).forEach(type => {
            const checks = businessRulesByType[type];
            const viewName = `${assertionDataset}.${tableInfo.tableIdForName}_business_rules_${type}_build`;
            const queries = [];

            checks.forEach(check => {
                switch (type) {
                    case 'freshness':
                        queries.push(...this._generateFreshnessViewQueries(check, tableInfo, partitionFilter));
                        break;
                    case 'row_count':
                        queries.push(...this._generateRowCountViewQueries(check, tableInfo, partitionFilter));
                        break;
                    case 'percentage':
                        queries.push(...this._generatePercentageViewQueries(check, tableInfo, partitionFilter));
                        break;
                }
            });

            if (queries.length > 0) {
                const unionQuery = queries.join('\nUNION ALL\n');
                // Use CONCAT to build the query string with partition_values embedded
                viewsSQL += `
-- 📊 BUSINESS RULES: Create ${type} assertion view with partition filtering
EXECUTE IMMEDIATE CONCAT("""
    CREATE OR REPLACE VIEW \`${viewName}\` AS
    """, REPLACE("""${unionQuery}""", "partition_values", partition_values));
`;
            }
        });

        return viewsSQL;
    }

    // Data Quality View Query Generators
    static _generateNotNullViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];

        if (check.columns) {
            check.columns.forEach(col => {
                queries.push(`SELECT '${col}' as rule_name, ${tableInfo.assertionColumnsList} FROM \`${tableInfo.tableRefForAssertions}\` WHERE ${col} IS NULL ${partitionFilter}`);
            });
        } else {
            queries.push(`SELECT '${check.column}' as rule_name, ${tableInfo.assertionColumnsList} FROM \`${tableInfo.tableRefForAssertions}\` WHERE ${check.column} IS NULL ${partitionFilter}`);
        }

        return queries;
    }

    static _generateUniqueKeyViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];
        const columnList = Array.isArray(check.columns) ? check.columns.join(', ') : check.columns;

        queries.push(`SELECT 'unique_key: ${columnList}' as rule_name, ${columnList}, COUNT(*) as count FROM \`${tableInfo.tableRefForAssertions}\` WHERE 1=1 ${partitionFilter} GROUP BY ${columnList} HAVING count > 1`);

        return queries;
    }

    static _generateAcceptedValuesViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];
        const valueList = check.values.map(v => `'${v}'`).join(', ');

        queries.push(`SELECT 'accepted_values: ${check.column}' as rule_name, ${tableInfo.assertionColumnsList} FROM \`${tableInfo.tableRefForAssertions}\` WHERE ${check.column} NOT IN (${valueList}) AND ${check.column} IS NOT NULL ${partitionFilter}`);

        return queries;
    }

    static _generateRelationshipViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];

        queries.push(`
            SELECT 'relationship: ${check.column} -> ${check.refTable}.${check.refColumn}' as rule_name,
                   ${tableInfo.assertionColumnsList}
            FROM \`${tableInfo.tableRefForAssertions}\` source
            WHERE source.${check.column} IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM \`${check.refTable}\` ref
                  WHERE ref.${check.refColumn} = source.${check.column}
              )
              ${partitionFilter}
        `);

        return queries;
    }

    // Business Rules View Query Generators
    static _generateFreshnessViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];
        const hoursThreshold = check.maxAgeHours || 24;

        queries.push(`
            SELECT 'freshness: ${check.dateColumn} > ${hoursThreshold}h' as rule_name,
                   ${tableInfo.assertionColumnsList}
            FROM \`${tableInfo.tableRefForAssertions}\`
            WHERE ${check.dateColumn} < DATETIME_SUB(CURRENT_DATETIME(), INTERVAL ${hoursThreshold} HOUR)
              ${partitionFilter}
        `);

        return queries;
    }

    static _generateRowCountViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];

        if (check.minRows !== undefined) {
            queries.push(`
                SELECT 'row_count: min_rows_${check.minRows}' as rule_name,
                       COUNT(*) as actual_count,
                       ${check.minRows} as min_expected
                FROM \`${tableInfo.tableRefForAssertions}\`
                WHERE 1=1 ${partitionFilter}
                HAVING COUNT(*) < ${check.minRows}
            `);
        }

        if (check.maxRows !== undefined) {
            queries.push(`
                SELECT 'row_count: max_rows_${check.maxRows}' as rule_name,
                       COUNT(*) as actual_count,
                       ${check.maxRows} as max_expected
                FROM \`${tableInfo.tableRefForAssertions}\`
                WHERE 1=1 ${partitionFilter}
                HAVING COUNT(*) > ${check.maxRows}
            `);
        }

        return queries;
    }

    static _generatePercentageViewQueries(check, tableInfo, partitionFilter) {
        const queries = [];
        const condition = check.condition;
        const percentage = check.percentage;

        queries.push(`
            SELECT "percentage: ${condition} >= ${percentage}%" as rule_name,
                   (SELECT COUNT(*) FROM \`${tableInfo.tableRefForAssertions}\` WHERE ${condition} ${partitionFilter}) as passing_count,
                   (SELECT COUNT(*) FROM \`${tableInfo.tableRefForAssertions}\` WHERE 1=1 ${partitionFilter}) as total_count,
                   ${percentage} as required_percentage
            FROM \`${tableInfo.tableRefForAssertions}\`
            WHERE (SELECT COUNT(*) FROM \`${tableInfo.tableRefForAssertions}\` WHERE ${condition} ${partitionFilter}) * 100.0
                  / NULLIF((SELECT COUNT(*) FROM \`${tableInfo.tableRefForAssertions}\` WHERE 1=1 ${partitionFilter}), 0) < ${percentage}
            LIMIT 1
        `);

        return queries;
    }

    /**
     * Parse table information from target and config (same logic as AssertionsManager)
     * @private
     */
    static _parseTableInfo(target, factoryConfig) {
        const cleanTarget = target.replace(/[`"']/g, '');
        const tableParts = cleanTarget.split('.');
        const dataset = tableParts.length > 2 ? tableParts[1] : tableParts[0];
        const table = tableParts.length > 2 ? tableParts[2] : tableParts[1] || tableParts[0];
        const tableIdForName = `${dataset}_${table}`;

        const fullTableRef = tableParts.length > 2 ? target : `\`your-project-id.${dataset}.${table}\``;
        const tableRefForAssertions = fullTableRef.replace(/[`]/g, '');

        const uniqueKeys = factoryConfig.uniqueKeys || ['ID'];
        const uniqueKeysList = Array.isArray(uniqueKeys) ? uniqueKeys.join(', ') : uniqueKeys;

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
     * Build partition filter for cost-effective assertions using partition_values variable
     * @private
     */
    static _buildPartitionFilter(factoryConfig, _modelMetadata, currentModelContext) {
        const partitionColumn = factoryConfig.partitionBy;
        const isIncremental = factoryConfig.type === 'incremental';

        let partitionFilter = '';

        // Use partition_values variable - works with EXECUTE IMMEDIATE!
        if (isIncremental && partitionColumn && !currentModelContext.fullRefresh) {
            partitionFilter = `AND ${partitionColumn} IN (partition_values)`;
        }

        return partitionFilter;
    }
}

module.exports = { AssertionViewsBuilder };