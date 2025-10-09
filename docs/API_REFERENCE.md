# API Reference

Complete documentation for the Advanced Factory and helper functions.

## Advanced Factory

### create(target, factoryConfig, configDescription)

Main factory function that generates SQL patterns based on configuration.

**Parameters:**
- `target` (string) - Target table name from `self()`
- `factoryConfig` (object) - Configuration object
- `configDescription` (string, optional) - Description from the model's config block

**Returns:**
```javascript
{
  preSQL: string,  // SQL before your SELECT
  postSQL: string  // SQL after your SELECT
}
```

**Example:**
```javascript
const { create } = require('includes/helpers');
const pattern = create(self(), {
    type: "incremental",
    uniqueKeys: ["unique_key"],
    partitionBy: "DATE(created_date)"
});
```

### model.dateFilter(dateColumn, useVariable)

Generates date filter clause for WHERE statements. Available as a method on the model object created by `create()`.

**Parameters:**
- `dateColumn` (string) - Date column name (default: `'updated_at'`)
- `useVariable` (boolean) - Use inline date calculations (default: `true`)

**Returns:** String with date filter SQL using inline `DATE_SUB()` calculations

**Example:**
```javascript
const { create } = require('includes/helpers');
const model = create(self(), factoryConfig);
const dateFilter = model.dateFilter;  // Extract for convenience

// Returns: DATE(created_date) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 3650 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 3649 DAY)
WHERE ${dateFilter('created_date')}
```

**Note:** As of v1.2.0, `dateFilter` is no longer exported globally. Use `model.dateFilter` instead to ensure each model uses its own `begin_daysBack` and `end_daysBack` configuration.

## Configuration Objects

### factoryConfig Structure

```javascript
{
    type: "incremental" | "table" | "view",

    // Core Options
    uniqueKeys: ["ID"],                    // Primary key for MERGE
    partitionBy: "CreationDay",            // Partition column
    clusterBy: ["Country", "Type"],        // Cluster columns (max 4)
    description: "Model description",       // Optional: overrides config description

    // Incremental Options
    begin_daysBack: 2,                     // Days to look back
    end_daysBack: 0,                       // Days to look forward
    stagingDataset: "Staging",             // Staging dataset
    timestampInStagingName: false,         // Include timestamp in staging table name (default: false)

    // View Options
    materialized: false,                   // Materialized view flag (default: false)
    autoRefresh: false,                    // Auto-refresh for materialized views
    refreshInterval: 60,                   // Refresh interval in minutes (default: 60)

    // Assertions
    assertions: {
        columns: ["ID", "updated_at"],     // Columns to show in assertion results
        data_quality: [...],               // Data quality checks
        business_rules: [...]              // Business rule checks
    }
}
```

### Model Types

#### Incremental (`type: "incremental"`)

**Purpose:** MERGE-based incremental loading with schema migration

**Features:**
- Dynamic schema detection and migration
- Partition-aware MERGE operations
- Automatic staging table management
- Date-based filtering

**Best For:** Transaction tables, event logs, high-volume data

**Example:**
```javascript
{
    type: "incremental",
    uniqueKeys: ["unique_key"],
    partitionBy: "DATE(created_date)",
    clusterBy: ["borough", "agency", "status"],
    begin_daysBack: 3
}
```

#### Table (`type: "table"`)

**Purpose:** Full refresh snapshot with CREATE OR REPLACE

**Features:**
- Complete table rebuild
- Automatic schema evolution
- Partitioning and clustering support
- No staging table needed

**Best For:** Analytics aggregations, monthly reports, data marts

**Example:**
```javascript
{
    type: "table",
    partitionBy: "report_month",
    clusterBy: ["borough", "agency_category"],
    description: "Monthly service request metrics"
}
```

#### View (`type: "view"`)

**Purpose:** Real-time views or materialized views for live data access

**Features:**
- Standard views (real-time, no storage)
- Materialized views (cached, auto-refresh capable)
- Query performance optimization

**Best For:** Dashboards, live reports, data exploration, performance-critical queries

**Examples:**

**Regular View:**
```javascript
{
    type: "view",
    materialized: false,  // Default
    description: "Live service request summary"
}
```

**Materialized View:**
```javascript
{
    type: "view",
    materialized: true,
    description: "Cached service request metrics"
}
```

**Auto-Refreshing Materialized View:**
```javascript
{
    type: "view",
    materialized: true,
    autoRefresh: true,
    refreshInterval: 30,  // Every 30 minutes
    description: "Auto-updating NYC 311 dashboard view"
}
```

## Assertion Framework

### View-Based Architecture

Assertions use a revolutionary view-based architecture for optimal performance:

**How It Works:**
1. **View Creation During Compilation** - Assertion views are created during model compilation with partition filtering
2. **Cost Optimization** - Views include `WHERE CreationDay IN (partition_values)` to scan only relevant data
3. **Simple Assertion Queries** - Assertions simply query pre-built views: `SELECT * FROM \`view_name\``
4. **Configurable Storage** - Views stored in dedicated assertion dataset (configurable via `workflow_settings.yaml`)

**Configuration:**
```yaml
# workflow_settings.yaml
defaultProject: intelytix
defaultLocation: europe-west2
defaultAssertionDataset: QualityOPs  # Assertion views storage
```

**Example Generated View:**
```sql
CREATE OR REPLACE VIEW `QualityOPs.table_data_quality_not_null_build` AS
SELECT 'unique_key' as rule_name, unique_key, created_date
FROM `table`
WHERE unique_key IS NULL
  AND DATE(created_date) IN ('2024-01-01', '2024-01-02');  -- Partition filtering
```

**Performance Benefits:**
- **Cost Reduction** - Only scans incremental partitions instead of full tables
- **Query Simplification** - Assertions become simple view queries
- **Scalability** - Efficient handling of multi-TB tables
- **Maintenance** - Complex logic centralized in views

### Custom Assertion Columns
```javascript
assertions: {
    columns: ['ID', 'CreatedAt'],  // Columns included in assertion views
    data_quality: [...],
    business_rules: [...]
}
```

### Data Quality Assertions

#### not_null
```javascript
// Single column
{ type: "not_null", column: "unique_key" }

// Multiple columns
{ type: "not_null", columns: ["unique_key", "created_date", "agency"] }
```

#### unique_key
```javascript
{ type: "unique_key", columns: ["unique_key"] }
{ type: "unique_key", columns: ["agency", "created_date", "incident_zip"] }
```

#### accepted_values
```javascript
{ type: "accepted_values", column: "status", values: ["Open", "Closed", "Pending", "In Progress", "Assigned"] }
{ type: "accepted_values", column: "borough", values: ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"] }
```

#### relationships
```javascript
{
    type: "relationships",
    column: "agency",
    refTable: "your-project.reference_data.agencies",
    refColumn: "agency_code"
}
```

### Business Rule Assertions

#### freshness
```javascript
{ type: "freshness", dateColumn: "created_date", maxAgeHours: 48 }
```

#### row_count
```javascript
{ type: "row_count", minRows: 100, maxRows: 10000 }
```

#### percentage
```javascript
{ type: "percentage", condition: "status = 'Closed'", percentage: 85 }
{ type: "percentage", condition: "borough IS NOT NULL", percentage: 95 }
```

### Assertion Configuration

```javascript
assertions: {
    // Custom columns to show in assertion results (defaults to uniqueKeys)
    columns: ["unique_key", "agency_name", "created_date"],

    data_quality: [
        { type: "not_null", column: "unique_key" },
        { type: "not_null", columns: ["created_date", "agency"] },  // Multiple columns
        { type: "unique_key", columns: ["unique_key"] },
        { type: "accepted_values", column: "borough", values: ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"] },
        { type: "relationships", column: "agency", refTable: "your-project.reference_data.agencies", refColumn: "agency_code" }
    ],

    business_rules: [
        { type: "freshness", dateColumn: "created_date", maxAgeHours: 48 },
        { type: "row_count", minRows: 1000, maxRows: 50000 },
        { type: "percentage", condition: "agency IS NOT NULL", percentage: 99 },
        { type: "percentage", condition: "status = 'Closed'", percentage: 75 }
    ]
}
```

## Description Handling

The Advanced Factory uses a priority system for table descriptions:

1. **factoryConfig.description** - Highest priority (overrides everything)
2. **config.description** - Medium priority (from the model's config block)
3. **Empty string** - Default if neither is provided

**Recommended approach:**
```sql
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    description: "NYC 311 service request analysis with enrichment"
}

js {
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["unique_key"]
        // No description needed - will use config description
    };
}
```

**Override config description when needed:**
```javascript
const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["unique_key"],
    description: "Special override description"  // This takes precedence
};
```

## Advanced Configuration

### Partition Strategies

**Date Partitioning:**
```javascript
partitionBy: "DATE(created_date)"
partitionBy: "created_day"  // Pre-computed date column
```

**Ingestion Time Partitioning:**
```javascript
partitionBy: "_PARTITIONTIME"
```

### Clustering Guidelines

1. **First Column:** Highest cardinality filter column
2. **Order:** By query filter frequency
3. **Maximum:** 4 columns
4. **Types:** Support string, integer, date, timestamp

```javascript
clusterBy: ["borough", "agency", "status", "created_day"]
```

### Performance Options

```javascript
{
    // Incremental tuning
    begin_daysBack: 1,      // Minimize lookback for speed
    end_daysBack: 0,        // Current day only

    // Staging optimization
    stagingDataset: "Staging_Fast",  // Dedicated staging dataset

    // Clustering for query performance
    clusterBy: ["borough", "agency", "complaint_type", "status"]
}
```

## Error Handling

### Common Errors and Solutions

**Schema Migration Failures:**
- Check column data types compatibility
- Verify table permissions
- Review BigQuery quotas

**MERGE Operation Timeouts:**
- Reduce `begin_daysBack` range
- Add selective WHERE clauses
- Check partition pruning

**Assertion View Failures:**
- Validate source table exists
- Check QualityOPs dataset permissions
- Review assertion logic syntax

## Utility Functions

### Available Exports

```javascript
const {
    // Main functions (most commonly used)
    create,
    dateFilter,
    advancedFactory,

    // Core infrastructure
    SchemaManager,
    MergeBuilder,
    TableBuilder,

    // Assertion modules
    AssertionsManager,
    DataQualityAssertions,
    BusinessRulesAssertions,

    // Pattern modules
    IncrementalPattern,
    SnapshotPattern,
    ViewPattern,

    // Utilities
    SQLXUtils,
    DateFilter,
    TableOptions
} = require('includes/helpers');
```

### Import Patterns

```javascript
// Minimal import (recommended)
const { create, dateFilter } = require('includes/helpers');

// Full factory access
const { advancedFactory } = require('includes/helpers');

// Advanced development
const { SQLXUtils, CONSTANTS } = require('includes/helpers');
```