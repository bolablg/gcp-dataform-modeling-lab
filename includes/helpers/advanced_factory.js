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
    currentModelContext.begin_daysBack = factoryConfig.begin_daysBack || 2;
    currentModelContext.end_daysBack = factoryConfig.end_daysBack || 0;

    // Store model-specific context for later use by dateFilter
    SQLXUtils.setModelContext(target, {
        fullRefresh: factoryConfig.fullRefresh || false,
        begin_daysBack: factoryConfig.begin_daysBack || 2,
        end_daysBack: factoryConfig.end_daysBack || 0
    });

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

    // Create a dateFilter function bound to this model's context
    result.dateFilter = (dateColumn = 'updated_at', useVariable = true) => {
        const context = SQLXUtils.getModelContext(target);
        const fullRefresh = context.fullRefresh || false;
        const begin_daysBack = context.begin_daysBack !== undefined ? context.begin_daysBack : 2;
        const end_daysBack = context.end_daysBack !== undefined ? context.end_daysBack : 0;
        return SQLXUtils.dateFilter(dateColumn, useVariable, fullRefresh, begin_daysBack, end_daysBack);
    };

    return result;
}

// Expose utility functions (global dateFilter for backward compatibility)
function dateFilter(dateColumn = 'updated_at', useVariable = true) {
    // Get model-specific context
    const context = SQLXUtils.getModelContext(currentModelContext.targetTable) || currentModelContext;
    const fullRefresh = context.fullRefresh || false;
    const begin_daysBack = context.begin_daysBack || 2;
    const end_daysBack = context.end_daysBack || 0;
    return SQLXUtils.dateFilter(dateColumn, useVariable, fullRefresh, begin_daysBack, end_daysBack);
}

module.exports = { create, dateFilter };