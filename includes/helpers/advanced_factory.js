const { SQLXUtils } = require('./utilities/sqlx-utils.js');
const { AssertionsManager } = require('./assertions/assertions-manager.js');
const { ConfigValidator } = require('./utilities/config-validator.js');

// Global context to store current model's fullRefresh state
let currentModelContext = {
    fullRefresh: false,
    targetTable: null
};

/**
 * Factory function to generate the appropriate SQL pattern based on the model's config.
 * @param {string} target The name of the target table/view.
 * @param {object} factoryConfig The custom configuration object.
 * @param {string} configDescription Optional description from the model's config block.
 * @returns {{preSQL: string, postSQL: string, assertions?: object}}
 */
function create(target, factoryConfig, configDescription = '') {
    // Validate configuration first
    const validation = ConfigValidator.validateFactoryConfig(factoryConfig, target);

    if (!validation.isValid) {
        const errorMessage = ConfigValidator.formatValidationMessage(validation, target);
        throw new Error(`Invalid factoryConfig:\n${errorMessage}`);
    }

    // Log warnings if any (non-blocking)
    if (validation.warnings.length > 0) {
        const warningMessage = ConfigValidator.formatValidationMessage(validation, target);
        console.warn(warningMessage);
    }

    // Merge factoryConfig with description priority: factoryConfig.description > configDescription > empty
    const mergedConfig = {
        ...factoryConfig,
        description: factoryConfig.description || configDescription || ''
    };

    // Update global context for this model
    currentModelContext.fullRefresh = factoryConfig.fullRefresh || false;
    currentModelContext.targetTable = target;

    const result = {};

    switch (factoryConfig.type) {
        case 'incremental':
            // When fullRefresh is true, use snapshot pattern for true table replacement
            if (factoryConfig.fullRefresh) {
                result.model = SQLXUtils.snapshotPattern(target, mergedConfig);
                result.fullRefresh = true; // Mark as full refresh for dateFilter
            } else {
                result.model = SQLXUtils.incrementalPattern(target, factoryConfig.uniqueKeys, mergedConfig);
                result.fullRefresh = false; // Standard incremental behavior
            }
            break;
        case 'table':
            result.model = SQLXUtils.snapshotPattern(target, mergedConfig);
            result.fullRefresh = factoryConfig.fullRefresh || false; // Tables are always full refresh
            break;
        case 'view':
            result.model = SQLXUtils.viewPattern(target, mergedConfig);
            result.fullRefresh = factoryConfig.fullRefresh || false; // Views are always real-time
            break;
        default:
            // For custom types that are not recognized, do nothing.
            result.model = { preSQL: '', postSQL: '' };
            result.fullRefresh = factoryConfig.fullRefresh || false;
    }

    // Create assertions after model completion - they depend on the completed model
    if (factoryConfig.assertions) {
        AssertionsManager.generateAssertions(target, factoryConfig, result.model, currentModelContext);
    }

    // For backward compatibility, expose preSQL and postSQL at top level
    result.preSQL = result.model.preSQL;
    result.postSQL = result.model.postSQL;
    result.metadata = result.model.metadata;

    return result;
}

// Expose utility functions
function dateFilter(dateColumn = 'updated_at', useVariable = true) {
    // Automatically use fullRefresh from current model context
    const fullRefresh = currentModelContext.fullRefresh;
    return SQLXUtils.dateFilter(dateColumn, useVariable, fullRefresh);
}

module.exports = { create, dateFilter };