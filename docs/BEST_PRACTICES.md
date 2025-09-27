# Best Practices

Guidelines for optimal performance, maintainability, and team collaboration.

## 🏗️ Model Organization

### Directory Structure
```
definitions/
├── models/
│   ├── core/              # Critical civic data tables (service requests, agencies)
│   │   ├── nyc_311_requests.sqlx
│   │   └── agency_lookup.sqlx
│   ├── marts/             # Analytics-ready tables
│   │   ├── borough_metrics.sqlx
│   │   └── agency_performance.sqlx
│   └── staging/           # Data processing intermediate tables
│       └── raw_processing.sqlx
├── views/
│   ├── analytics/         # Business analytics views
│   └── reports/           # Operational reporting views
└── assertions/            # Data quality tests
    └── core_data_tests.sqlx
```

### Naming Conventions
- **Tables**: `nyc_311_requests`, `borough_metrics`, `daily_service_summary`
- **Views**: `analytics_borough_summary`, `report_daily_requests`
- **Staging**: `staging_raw_requests`, `temp_calculations`

## ⚡ Performance Optimization

### 1. Partitioning Strategy

**✅ Good Partitioning:**
```javascript
// Date partitioning for time-series data
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],
  partitionBy: "DATE(created_date)",          // Most common filter
  clusterBy: ["borough", "agency"]            // Secondary filters
}

// Ingestion time partitioning
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["event_id"],
  partitionBy: "_PARTITIONTIME",
  clusterBy: ["user_id", "event_type"]
}
```

**❌ Avoid:**
```javascript
// Over-partitioning (too many small partitions)
const badConfig = {
  type: "incremental",
  partitionBy: "DATETIME_TRUNC(created_at, HOUR)"  // Too granular
}

// Non-filtered partitions
const badConfig = {
  type: "incremental",
  partitionBy: "random_column"  // Never used in WHERE clauses
}
```

### 2. Clustering Strategy

**✅ Optimal Clustering:**
```javascript
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],
  // Order by filter frequency (most filtered first)
  clusterBy: ["borough", "agency", "complaint_type", "status"]
}
```

**Rules:**
- Maximum 4 cluster columns
- Order by query filter frequency
- Include high-cardinality columns first
- Avoid low-cardinality columns (< 10 values)

### 3. Incremental Loading

**✅ Efficient Date Windows:**
```javascript
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["id"],
  begin_daysBack: 2,    // Usually 1-3 days for most use cases
  end_daysBack: 0       // Current day
}

// For high-volume tables
const factoryConfig = {
  type: "incremental",
  begin_daysBack: 1     // Minimize data processed
}

// For delayed data sources
const factoryConfig = {
  type: "incremental",
  begin_daysBack: 7,    // Account for late-arriving data
  end_daysBack: 1       // Exclude today (incomplete)
}
```

### 4. Source Query Optimization

**✅ Selective WHERE Clauses:**
```sql
js {
  const { create, dateFilter } = require('includes/helpers');
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["id"]
  }
}

${ create(self(), factoryConfig).preSQL }

SELECT *
FROM ${ref("large_source_table")}
WHERE ${dateFilter('updated_at')}
  AND status IN ('active', 'pending')  -- Additional filters
  AND amount > 0                       -- Business logic filters

${ create(self(), factoryConfig).postSQL }
```

## 🔧 Configuration Best Practices

### 1. Always Define Unique Keys Explicitly
```javascript
// ✅ Good: Explicit unique keys
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"]
}

// ❌ Avoid: Relying on defaults
const factoryConfig = {
  type: "incremental"
  // Missing uniqueKeys - will use ['ID'] by default
}
```

### 2. Use Meaningful Descriptions
```javascript
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],
  description: "Daily NYC 311 service requests with agency enrichment. Updated every 4 hours."
  // Not just: "Service request table"
}
```

### 3. Appropriate Staging Datasets
```javascript
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["id"],
  stagingDataset: "Staging"        // For production
  // stagingDataset: "Dev_Staging"  // For development
}
```

## 📊 Data Quality Best Practices

### 1. Essential Assertions
```javascript
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],

  assertions: {
    // Custom columns for assertion results
    columns: ["unique_key", "agency_name", "created_date"],

    data_quality: [
      { type: "unique_key", columns: ["unique_key"] },                  // Always check primary key
      { type: "not_null", columns: ["agency", "created_date"] },        // Critical fields
      { type: "accepted_values", column: "status", values: ["Open", "Closed", "Pending", "In Progress"] },
      { type: "relationships", column: "agency", refTable: "agency_lookup", refColumn: "agency_code" }
    ],

    business_rules: [
      { type: "freshness", dateColumn: "created_date", maxAgeHours: 48 },  // Data freshness
      { type: "row_count", minRows: 100, maxRows: 1000000 },              // Volume checks
      { type: "percentage", condition: "agency IS NOT NULL", percentage: 99 }  // Business logic
    ]
  }
}
```

### 2. Comprehensive Assertion Strategies

**Data Quality Layers:**
```javascript
// Layer 1: Critical constraints
data_quality: [
  { type: "not_null", columns: ["unique_key", "created_date", "agency"] },
  { type: "unique_key", columns: ["unique_key"] }
]

// Layer 2: Referential integrity
data_quality: [
  { type: "relationships", column: "agency", refTable: "agency_lookup", refColumn: "agency_code" },
  { type: "relationships", column: "borough", refTable: "borough_lookup", refColumn: "borough_name" }
]

// Layer 3: Business value validation
data_quality: [
  { type: "accepted_values", column: "borough", values: ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"] },
  { type: "accepted_values", column: "status", values: ["Open", "Closed", "Pending", "In Progress", "Assigned"] }
]
```

**Business Rule Monitoring:**
```javascript
business_rules: [
  { type: "freshness", dateColumn: "created_date", maxAgeHours: 6 },      // Real-time data
  { type: "row_count", minRows: 1000 },                                   // Daily volume check
  { type: "percentage", condition: "agency IS NOT NULL", percentage: 99 }, // Valid agencies
  { type: "percentage", condition: "status = 'Closed'", percentage: 70 }   // Resolution rate
]
```

### 3. Advanced Assertion Patterns

**Multi-condition Validation:**
```javascript
business_rules: [
  { type: "percentage", condition: "complaint_type IS NOT NULL", percentage: 98 },
  { type: "percentage", condition: "DATE_DIFF(CURRENT_DATE(), DATE(created_date), DAY) <= 30", percentage: 90 }
]
```

**Cost-Effective Partition Filtering:**
```javascript
// Assertions automatically filter by staging table partitions for incremental models
// This reduces costs by only checking newly processed data
const factoryConfig = {
  type: "incremental",
  partitionBy: "DATE(created_date)",
  assertions: {
    // These assertions will only run on the partitions processed in this run
    data_quality: [{ type: "not_null", column: "unique_key" }]
  }
}
```

## 👥 Team Collaboration

### 1. Consistent Configuration Patterns
```javascript
// Establish team standards
const TEAM_DEFAULTS = {
  stagingDataset: "DataTeam_Staging",
  begin_daysBack: 2,
  partitionExpirationDays: 90
};

// Use in models
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],
  ...TEAM_DEFAULTS,
  partitionBy: "DATE(created_date)",
  clusterBy: ["borough"]
};
```

### 2. Code Review Checklist
- [ ] Unique keys are correct and sufficient
- [ ] Partitioning strategy matches query patterns
- [ ] Clustering columns are ordered by filter frequency
- [ ] Date windows are appropriate for data volume
- [ ] Assertions cover critical business rules
- [ ] Table description is meaningful
- [ ] Dependencies are correctly declared

### 3. Documentation Standards
```sql
config {
  schema: "CivicData",
  type: "operations",
  hasOutput: true,
  tags: ["daily", "civic_data", "core"],
  description: "NYC 311 service request data with agency and borough enrichment. Updates every 6 hours with 2-day lookback for late-arriving data."
}
```

## 🚀 Development Workflow

### 1. Model Development Process
1. **Start with snapshot** - Test business logic first
2. **Add incremental pattern** - Once logic is validated
3. **Add assertions** - Ensure data quality
4. **Performance test** - Validate on production-sized data
5. **Deploy and monitor** - Watch for issues first 48 hours

### 2. Testing Strategy
```sql
-- Test model with small data first
WHERE DATE(created_date) = '2024-01-01'  -- Single day test
-- Then expand to full date range
WHERE ${dateFilter('created_date')}
```

### 3. Monitoring and Alerting
- Monitor execution times
- Track row counts over time
- Alert on assertion failures
- Monitor partition sizes

## 🔍 Debugging and Monitoring

### 1. Common Issues
- **Schema detection failures**: Check table permissions
- **Merge key mismatches**: Verify column names and types
- **Partition pruning not working**: Ensure WHERE clause uses partition column
- **High costs**: Review clustering and partitioning strategy

### 2. Performance Monitoring
```sql
-- Add to post-operations for monitoring
INSERT INTO dataform_execution_log VALUES (
  CURRENT_DATETIME(),
  '${self()}',
  @@row_count,
  'completed'
);
```

### 3. Cost Optimization
- Use partition expiration for historical data
- Monitor slot usage during execution
- Optimize cluster columns based on query patterns
- Use appropriate date windows for incremental loads

## 📈 Scaling Considerations

### For High-Volume Tables (> 1TB)
- Reduce `beginDays` to minimum viable window
- Increase clustering columns for better pruning
- Consider hourly partitioning for very high volume
- Use streaming inserts instead of batch for real-time data

### For Many Small Tables
- Use snapshot patterns instead of incremental
- Consider combining related tables
- Batch multiple small tables in single operations

### For Complex Transformations
- Break into multiple staged models
- Use intermediate tables for complex joins
- Optimize with appropriate materializations

## 🎯 Pattern-Specific Best Practices

### View Pattern Optimization

**Regular Views:**
```javascript
const factoryConfig = {
  type: "view",
  materialized: false,  // Default - real-time data
  description: "Live service request metrics for dashboards"
}
```

**Materialized Views for Performance:**
```javascript
const factoryConfig = {
  type: "view",
  materialized: true,
  autoRefresh: true,
  refreshInterval: 30,  // Refresh every 30 minutes
  description: "Cached service request summary for fast dashboard access"
}
```

**When to Use Materialized Views:**
- ✅ Complex service request aggregations used by multiple dashboards
- ✅ Expensive joins across large civic datasets
- ✅ Reports requiring consistent snapshots
- ❌ Real-time data requirements
- ❌ Frequently changing base data

### Assertion Best Practices by Environment

**Development Environment:**
```javascript
assertions: {
  data_quality: [
    { type: "not_null", columns: ["unique_key"] },  // Basic checks only
    { type: "unique_key", columns: ["unique_key"] }
  ]
}
```

**Production Environment:**
```javascript
assertions: {
  columns: ["unique_key", "agency_name", "complaint_type", "created_date"],
  data_quality: [
    { type: "not_null", columns: ["unique_key", "agency", "created_date"] },
    { type: "unique_key", columns: ["unique_key"] },
    { type: "accepted_values", column: "status", values: ["Open", "Closed", "Pending", "In Progress"] },
    { type: "relationships", column: "agency", refTable: "agency_lookup", refColumn: "agency_code" }
  ],
  business_rules: [
    { type: "freshness", dateColumn: "created_date", maxAgeHours: 24 },
    { type: "row_count", minRows: 100 },
    { type: "percentage", condition: "agency IS NOT NULL", percentage: 99 }
  ]
}
```

## 🔧 Advanced Configuration Patterns

### Environment-Specific Configurations
```javascript
// Base configuration
const baseConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],
  partitionBy: "DATE(created_date)"
};

// Environment-specific overrides
const prodConfig = {
  ...baseConfig,
  stagingDataset: "Production_Staging",
  begin_daysBack: 1,  // Minimize processing in prod
  assertions: { /* full assertion suite */ }
};

const devConfig = {
  ...baseConfig,
  stagingDataset: "Dev_Staging",
  begin_daysBack: 7,  // More data for testing
  assertions: { /* basic assertions only */ }
};
```

### Multi-Region Deployment
```javascript
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["unique_key"],
  partitionBy: "DATE(created_date)",
  clusterBy: ["borough", "agency"],   // Borough-first clustering
  description: `${dataform.projectConfig.vars.REGION} service request data`
}
```