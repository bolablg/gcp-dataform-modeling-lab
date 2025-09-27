/**
 * Configuration Validator
 * Validates factoryConfig properties and provides helpful error messages
 */

class ConfigValidator {

    /**
     * Validate factory configuration object
     * @param {object} factoryConfig - Configuration object to validate
     * @param {string} target - Target table name for context
     * @returns {object} Validation result { isValid, errors, warnings }
     */
    static validateFactoryConfig(factoryConfig, target = 'unknown') {
        const errors = [];
        const warnings = [];

        if (!factoryConfig || typeof factoryConfig !== 'object') {
            errors.push('factoryConfig must be a valid object');
            return { isValid: false, errors, warnings };
        }

        // Validate required properties
        this._validateRequiredProperties(factoryConfig, errors);

        // Validate type-specific properties
        this._validateTypeSpecificProperties(factoryConfig, errors, warnings);

        // Validate common properties
        this._validateCommonProperties(factoryConfig, errors, warnings);

        // Validate assertions if present
        if (factoryConfig.assertions) {
            this._validateAssertions(factoryConfig.assertions, errors, warnings);
        }

        // Check for unknown properties
        this._checkUnknownProperties(factoryConfig, warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate required properties
     * @private
     */
    static _validateRequiredProperties(config, errors) {
        // Type is always required
        if (!config.type) {
            errors.push('Missing required property "type". Must be one of: "incremental", "table", "view"');
            return;
        }

        const validTypes = ['incremental', 'table', 'view'];
        if (!validTypes.includes(config.type)) {
            errors.push(`Invalid "type" value: "${config.type}". Must be one of: ${validTypes.join(', ')}`);
        }

        // Unique keys required for incremental
        if (config.type === 'incremental' && (!config.uniqueKeys || config.uniqueKeys.length === 0)) {
            errors.push('Incremental models require "uniqueKeys" property with at least one key');
        }
    }

    /**
     * Validate type-specific properties
     * @private
     */
    static _validateTypeSpecificProperties(config, errors, warnings) {
        switch (config.type) {
            case 'incremental':
                this._validateIncrementalProperties(config, errors, warnings);
                break;
            case 'table':
                this._validateTableProperties(config, errors, warnings);
                break;
            case 'view':
                this._validateViewProperties(config, errors, warnings);
                break;
        }
    }

    /**
     * Validate incremental-specific properties
     * @private
     */
    static _validateIncrementalProperties(config, errors, warnings) {
        // Validate uniqueKeys
        if (config.uniqueKeys) {
            if (!Array.isArray(config.uniqueKeys)) {
                errors.push('uniqueKeys must be an array of column names');
            } else if (config.uniqueKeys.some(key => typeof key !== 'string')) {
                errors.push('All uniqueKeys must be strings (column names)');
            }
        }

        // Validate date ranges
        if (typeof config.begin_daysBack !== 'undefined') {
            if (!Number.isInteger(config.begin_daysBack) || config.begin_daysBack < 0) {
                errors.push('begin_daysBack must be a non-negative integer');
            }
            if (config.begin_daysBack > 365) {
                warnings.push('begin_daysBack > 365 days may impact performance and costs');
            }
        }

        if (typeof config.end_daysBack !== 'undefined') {
            if (!Number.isInteger(config.end_daysBack) || config.end_daysBack < 0) {
                errors.push('end_daysBack must be a non-negative integer');
            }
        }

        // Validate staging dataset
        if (config.stagingDataset && typeof config.stagingDataset !== 'string') {
            errors.push('stagingDataset must be a string');
        }

        // Validate fullRefresh
        if (config.fullRefresh && typeof config.fullRefresh !== 'boolean') {
            errors.push('fullRefresh must be a boolean');
        }

        // Validate timestampInStagingName
        if (config.timestampInStagingName && typeof config.timestampInStagingName !== 'boolean') {
            errors.push('timestampInStagingName must be a boolean');
        }
    }

    /**
     * Validate table-specific properties
     * @private
     */
    static _validateTableProperties(config, errors, warnings) {
        // Tables don't have unique keys
        if (config.uniqueKeys) {
            warnings.push('uniqueKeys property is ignored for table type (full refresh)');
        }

        // Tables don't need date ranges
        if (config.begin_daysBack || config.end_daysBack) {
            warnings.push('begin_daysBack/end_daysBack properties are ignored for table type (full refresh)');
        }
    }

    /**
     * Validate view-specific properties
     * @private
     */
    static _validateViewProperties(config, errors, warnings) {
        // Views don't have unique keys
        if (config.uniqueKeys) {
            warnings.push('uniqueKeys property is ignored for view type');
        }

        // Views don't need date ranges
        if (config.begin_daysBack || config.end_daysBack) {
            warnings.push('begin_daysBack/end_daysBack properties are ignored for view type');
        }

        // Validate materialized view properties
        if (config.materialized && typeof config.materialized !== 'boolean') {
            errors.push('materialized must be a boolean');
        }

        if (config.autoRefresh) {
            if (typeof config.autoRefresh !== 'boolean') {
                errors.push('autoRefresh must be a boolean');
            }
            if (!config.materialized) {
                warnings.push('autoRefresh only applies to materialized views (set materialized: true)');
            }
        }

        if (config.refreshInterval) {
            if (!Number.isInteger(config.refreshInterval) || config.refreshInterval < 1) {
                errors.push('refreshInterval must be a positive integer (minutes)');
            }
            if (!config.materialized || !config.autoRefresh) {
                warnings.push('refreshInterval only applies when materialized: true and autoRefresh: true');
            }
            if (config.refreshInterval < 15) {
                warnings.push('refreshInterval < 15 minutes may impact BigQuery quotas');
            }
        }
    }

    /**
     * Validate common properties
     * @private
     */
    static _validateCommonProperties(config, errors, warnings) {
        // Validate partitionBy
        if (config.partitionBy && typeof config.partitionBy !== 'string') {
            errors.push('partitionBy must be a string (column name or expression)');
        }

        // Validate clusterBy
        if (config.clusterBy) {
            if (!Array.isArray(config.clusterBy)) {
                errors.push('clusterBy must be an array of column names');
            } else {
                if (config.clusterBy.length > 4) {
                    errors.push('clusterBy can have maximum 4 columns');
                }
                if (config.clusterBy.some(col => typeof col !== 'string')) {
                    errors.push('All clusterBy columns must be strings');
                }
            }
        }

        // Validate description
        if (config.description && typeof config.description !== 'string') {
            errors.push('description must be a string');
        }
    }

    /**
     * Validate assertions configuration
     * @private
     */
    static _validateAssertions(assertions, errors, warnings) {
        if (typeof assertions !== 'object' || assertions === null) {
            errors.push('assertions must be an object');
            return;
        }

        // Validate assertions.columns
        if (assertions.columns) {
            if (!Array.isArray(assertions.columns)) {
                errors.push('assertions.columns must be an array of column names');
            } else if (assertions.columns.some(col => typeof col !== 'string')) {
                errors.push('All assertion columns must be strings');
            }
        }

        // Validate data_quality assertions
        if (assertions.data_quality) {
            if (!Array.isArray(assertions.data_quality)) {
                errors.push('assertions.data_quality must be an array');
            } else {
                assertions.data_quality.forEach((assertion, index) => {
                    this._validateDataQualityAssertion(assertion, `data_quality[${index}]`, errors, warnings);
                });
            }
        }

        // Validate business_rules assertions
        if (assertions.business_rules) {
            if (!Array.isArray(assertions.business_rules)) {
                errors.push('assertions.business_rules must be an array');
            } else {
                assertions.business_rules.forEach((assertion, index) => {
                    this._validateBusinessRuleAssertion(assertion, `business_rules[${index}]`, errors, warnings);
                });
            }
        }
    }

    /**
     * Validate individual data quality assertion
     * @private
     */
    static _validateDataQualityAssertion(assertion, context, errors, warnings) {
        if (!assertion.type) {
            errors.push(`${context}: Missing required property "type"`);
            return;
        }

        const validTypes = ['not_null', 'unique_key', 'accepted_values', 'relationships'];
        if (!validTypes.includes(assertion.type)) {
            errors.push(`${context}: Invalid type "${assertion.type}". Valid types: ${validTypes.join(', ')}`);
            return;
        }

        switch (assertion.type) {
            case 'not_null':
                if (!assertion.column && !assertion.columns) {
                    errors.push(`${context}: not_null assertion requires "column" or "columns" property`);
                }
                break;
            case 'unique_key':
                if (!assertion.columns) {
                    errors.push(`${context}: unique_key assertion requires "columns" property`);
                } else if (!Array.isArray(assertion.columns)) {
                    errors.push(`${context}: unique_key "columns" must be an array`);
                }
                break;
            case 'accepted_values':
                if (!assertion.column) {
                    errors.push(`${context}: accepted_values assertion requires "column" property`);
                }
                if (!assertion.values || !Array.isArray(assertion.values)) {
                    errors.push(`${context}: accepted_values assertion requires "values" array`);
                }
                break;
            case 'relationships':
                if (!assertion.column || !assertion.refTable || !assertion.refColumn) {
                    errors.push(`${context}: relationships assertion requires "column", "refTable", and "refColumn" properties`);
                }
                break;
        }
    }

    /**
     * Validate individual business rule assertion
     * @private
     */
    static _validateBusinessRuleAssertion(assertion, context, errors, warnings) {
        if (!assertion.type) {
            errors.push(`${context}: Missing required property "type"`);
            return;
        }

        const validTypes = ['freshness', 'row_count', 'percentage'];
        if (!validTypes.includes(assertion.type)) {
            errors.push(`${context}: Invalid type "${assertion.type}". Valid types: ${validTypes.join(', ')}`);
            return;
        }

        switch (assertion.type) {
            case 'freshness':
                if (!assertion.dateColumn) {
                    errors.push(`${context}: freshness assertion requires "dateColumn" property`);
                }
                if (assertion.maxAgeHours && (!Number.isInteger(assertion.maxAgeHours) || assertion.maxAgeHours < 1)) {
                    errors.push(`${context}: maxAgeHours must be a positive integer`);
                }
                break;
            case 'row_count':
                if (assertion.minRows !== undefined && (!Number.isInteger(assertion.minRows) || assertion.minRows < 0)) {
                    errors.push(`${context}: minRows must be a non-negative integer`);
                }
                if (assertion.maxRows !== undefined && (!Number.isInteger(assertion.maxRows) || assertion.maxRows < 0)) {
                    errors.push(`${context}: maxRows must be a non-negative integer`);
                }
                if (assertion.minRows === undefined && assertion.maxRows === undefined) {
                    errors.push(`${context}: row_count assertion requires at least "minRows" or "maxRows"`);
                }
                break;
            case 'percentage':
                if (!assertion.condition) {
                    errors.push(`${context}: percentage assertion requires "condition" property`);
                }
                if (assertion.percentage === undefined || typeof assertion.percentage !== 'number' || assertion.percentage < 0 || assertion.percentage > 100) {
                    errors.push(`${context}: percentage must be a number between 0 and 100`);
                }
                break;
        }
    }

    /**
     * Check for unknown properties and warn about them
     * @private
     */
    static _checkUnknownProperties(config, warnings) {
        const knownProperties = new Set([
            'type', 'uniqueKeys', 'partitionBy', 'clusterBy', 'description',
            'begin_daysBack', 'end_daysBack', 'stagingDataset', 'fullRefresh',
            'materialized', 'autoRefresh', 'refreshInterval', 'assertions',
            'timestampInStagingName', 'labels', 'partitionExpirationDays'
        ]);

        Object.keys(config).forEach(prop => {
            if (!knownProperties.has(prop)) {
                warnings.push(`Unknown property "${prop}" will be ignored`);
            }
        });
    }

    /**
     * Format validation errors and warnings for display
     * @param {object} validation - Validation result
     * @param {string} target - Target table name
     * @returns {string} Formatted message
     */
    static formatValidationMessage(validation, target) {
        if (validation.isValid && validation.warnings.length === 0) {
            return null; // No issues
        }

        let message = `Configuration validation for ${target}:\n`;

        if (validation.errors.length > 0) {
            message += '\n❌ ERRORS:\n';
            validation.errors.forEach(error => {
                message += `  - ${error}\n`;
            });
        }

        if (validation.warnings.length > 0) {
            message += '\n⚠️  WARNINGS:\n';
            validation.warnings.forEach(warning => {
                message += `  - ${warning}\n`;
            });
        }

        return message;
    }
}

module.exports = { ConfigValidator };