/**
 * Gozem Dataform Helpers - Central Export
 * Import everything you need from a single location
 */

// Main factory
const advancedFactory = require('./advanced_factory.js');

// Core utilities (if needed directly)
const { SQLXUtils } = require('./utilities/sqlx-utils.js');

// Core components
const { SchemaManager } = require('./core/schema-manager.js');
const { MergeBuilder } = require('./core/merge-builder.js');
const { TableBuilder } = require('./core/table-builder.js');
const { AssertionsManager } = require('./assertions/assertions-manager.js');
const { AssertionViewsBuilder } = require('./assertions/assertion-views-builder.js');
const { DataQualityAssertions } = require('./assertions/data-quality-assertions.js');
const { BusinessRulesAssertions } = require('./assertions/business-rules-assertions.js');
const { IncrementalPattern } = require('./patterns/incremental-pattern.js');
const { SnapshotPattern } = require('./patterns/snapshot-pattern.js');
const { ViewPattern } = require('./patterns/view-pattern.js');
const { DateFilter } = require('./utilities/date-filter.js');
const { TableOptions } = require('./utilities/table-options.js');
const { ConfigValidator } = require('./utilities/config-validator.js');
const { WorkflowConfig } = require('./utilities/workflow-config.js');


module.exports = {
    // Main exports - these are what you'll typically use
    advancedFactory,

    // Utility shortcuts
    create: advancedFactory.create,
    dateFilter: advancedFactory.dateFilter,

    // Advanced utilities (if needed)
    SQLXUtils,
    SchemaManager,
    MergeBuilder,
    TableBuilder,
    AssertionsManager,
    AssertionViewsBuilder,
    DataQualityAssertions,
    BusinessRulesAssertions,
    IncrementalPattern,
    SnapshotPattern,
    ViewPattern,
    DateFilter,
    TableOptions,
    ConfigValidator,
    WorkflowConfig
};