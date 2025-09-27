# Advanced Factory Examples

Comprehensive examples showcasing the Advanced Factory pattern for all model types with NYC 311 Service Requests data.

## 🚀 Quick Start

### Basic Incremental Model
```sql
-- definitions/models/nyc_311_requests.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["daily", "civic_data"]
}

js {
    const { create, dateFilter } = require('includes/helpers');
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["unique_key"],
        partitionBy: "DATE(created_date)",
        clusterBy: ["borough", "agency", "complaint_type"]
    }
}

${ create(self(), factoryConfig).preSQL }

SELECT
    unique_key,
    created_date,
    agency,
    complaint_type,
    borough,
    status,
    incident_address
FROM ${ref("products_db", "new_york_311_service_requests")}
WHERE ${dateFilter('created_date')}
    AND complaint_type IS NOT NULL

${ create(self(), factoryConfig).postSQL }
```

### Basic Table (Snapshot) Model
```sql
-- definitions/models/agency_monthly_summary.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["monthly", "agency", "snapshot"]
}

js {
    const { create } = require('includes/helpers');
    const factoryConfig = {
        type: "table",
        partitionBy: "report_month",
        clusterBy: ["borough", "agency_category"],
        description: "Monthly agency performance summary"
    }
}

${ create(self(), factoryConfig).preSQL }

SELECT
    agency,
    agency_name,
    borough,
    DATE_TRUNC(created_date, MONTH) as report_month,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'Closed' THEN 1 END) as resolved_requests,
    AVG(DATE_DIFF(closed_date, created_date, DAY)) as avg_resolution_days,
    CURRENT_DATE() as snapshot_date
FROM ${ref("products_db", "new_york_311_service_requests")}
GROUP BY agency, agency_name, borough, DATE_TRUNC(created_date, MONTH)

${ create(self(), factoryConfig).postSQL }
```

### Basic View Model
```sql
-- definitions/views/service_request_analytics.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["analytics", "civic_data"]
}

js {
    const { create } = require('includes/helpers');
    const factoryConfig = {
        type: "view",
        description: "NYC 311 service request analytics"
    }
}

${ create(self(), factoryConfig).preSQL }

SELECT
    agency,
    borough,
    complaint_type,
    COUNT(*) as request_count,
    COUNT(CASE WHEN status = 'Closed' THEN 1 END) as resolved_count,
    SAFE_DIVIDE(COUNT(CASE WHEN status = 'Closed' THEN 1 END), COUNT(*)) * 100 as resolution_rate
FROM ${ref("products_db", "new_york_311_service_requests")}
GROUP BY agency, borough, complaint_type

${ create(self(), factoryConfig).postSQL }
```

## 🏛️ Civic Data Examples

### Service Request Processing with Assertions
```sql
-- definitions/models/nyc_311_enriched.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["daily", "civic_data", "critical"]
}

js {
    const { create, dateFilter } = require('includes/helpers');
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["unique_key"],
        partitionBy: "DATE(created_date)",
        clusterBy: ["borough", "agency", "complaint_type"],
        begin_daysBack: 3,
        description: "NYC 311 service requests with enrichment",

        assertions: {
            materialized: true,
            data_quality: [
                // Multiple columns in single assertion
                { type: "not_null", columns: ["unique_key", "created_date", "agency"] },
                { type: "unique_key", columns: ["unique_key"] },
                { type: "accepted_values", column: "status", values: ["Open", "Closed", "Pending", "In Progress", "Assigned"] },
                { type: "accepted_values", column: "borough", values: ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND", "Unspecified"] }
            ],
            business_rules: [
                { type: "freshness", dateColumn: "created_date", maxAgeHours: 48 },
                { type: "row_count", minRows: 1000 },
                { type: "percentage", condition: "agency IS NOT NULL", percentage: 99 }
            ]
        }
    }
}

${ create(self(), factoryConfig).preSQL }

SELECT
    unique_key,
    created_date,
    closed_date,
    agency,
    agency_name,
    COALESCE(borough, 'Unspecified') as borough,
    complaint_type,
    descriptor,
    status,
    incident_address,
    incident_zip,
    latitude,
    longitude,

    -- Enrichment fields
    CASE
        WHEN agency IN ('NYPD', 'FDNY') THEN 'Public Safety'
        WHEN agency IN ('DOT', 'TLC') THEN 'Transportation'
        WHEN agency IN ('DEP', 'DSNY', 'DEA') THEN 'Environment'
        WHEN agency IN ('HPD', 'DOB') THEN 'Housing'
        WHEN agency IN ('DPR') THEN 'Parks'
        ELSE 'Other'
    END as agency_category,

    CASE
        WHEN closed_date IS NOT NULL
        THEN DATE_DIFF(closed_date, created_date, DAY)
        ELSE DATE_DIFF(CURRENT_DATE(), created_date, DAY)
    END as days_since_created,

    DATE(created_date) as created_day

FROM ${ref("products_db", "new_york_311_service_requests")}
WHERE ${dateFilter('created_date')}
    AND unique_key IS NOT NULL
    AND created_date IS NOT NULL

${ create(self(), factoryConfig).postSQL }
```

### Multi-Key MERGE Pattern
```sql
-- definitions/models/agency_daily_metrics.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["daily", "civic_data", "metrics"]
}

js {
    const { create, dateFilter } = require('includes/helpers');
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["agency", "borough", "metric_date"],
        partitionBy: "metric_date",
        clusterBy: ["agency_category", "borough"],
        begin_daysBack: 1,
        description: "Daily agency performance metrics by agency and borough"
    }
}

${ create(self(), factoryConfig).preSQL }

WITH daily_requests AS (
    SELECT
        agency,
        COALESCE(borough, 'Unspecified') as borough,
        DATE(created_date) as metric_date,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'Closed' THEN 1 END) as resolved_requests,
        COUNT(CASE WHEN status IN ('Open', 'In Progress', 'Assigned') THEN 1 END) as active_requests,
        AVG(CASE WHEN status = 'Closed' AND closed_date IS NOT NULL
            THEN DATE_DIFF(closed_date, created_date, DAY) END) as avg_resolution_days
    FROM ${ref("products_db", "new_york_311_service_requests")}
    WHERE ${dateFilter('created_date')}
    GROUP BY agency, COALESCE(borough, 'Unspecified'), DATE(created_date)
)
SELECT
    dr.agency,
    dr.borough,
    dr.metric_date,
    CASE
        WHEN dr.agency IN ('NYPD', 'FDNY') THEN 'Public Safety'
        WHEN dr.agency IN ('DOT', 'TLC') THEN 'Transportation'
        WHEN dr.agency IN ('DEP', 'DSNY', 'DEA') THEN 'Environment'
        WHEN dr.agency IN ('HPD', 'DOB') THEN 'Housing'
        WHEN dr.agency IN ('DPR') THEN 'Parks'
        ELSE 'Other'
    END as agency_category,
    dr.total_requests,
    dr.resolved_requests,
    dr.active_requests,
    dr.avg_resolution_days,
    SAFE_DIVIDE(dr.resolved_requests, dr.total_requests) * 100 as resolution_rate_percent
FROM daily_requests dr

${ create(self(), factoryConfig).postSQL }
```

## 📊 Civic Analytics Examples

### Analytics View with Materialized Assertions
```sql
-- definitions/views/borough_service_analytics.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["analytics", "borough"]
}

js {
    const { create } = require('includes/helpers');
    const factoryConfig = {
        type: "view",
        materialized: true,
        autoRefresh: true,
        refreshInterval: 60,
        description: "Borough service analytics with performance metrics",

        assertions: {
            materialized: false, // Keep view assertions lightweight
            data_quality: [
                { type: "not_null", column: "borough" },
                { type: "accepted_values", column: "performance_category", values: ["Excellent", "Good", "Fair", "Needs Improvement"] }
            ],
            business_rules: [
                { type: "row_count", minRows: 5 }
            ]
        }
    }
}

${ create(self(), factoryConfig).preSQL }

WITH borough_metrics AS (
    SELECT
        COALESCE(borough, 'Unspecified') as borough,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'Closed' THEN 1 END) as resolved_requests,
        COUNT(CASE WHEN status IN ('Open', 'In Progress', 'Assigned') THEN 1 END) as active_requests,
        AVG(CASE WHEN status = 'Closed' AND closed_date IS NOT NULL
            THEN DATE_DIFF(closed_date, created_date, DAY) END) as avg_resolution_days,
        MIN(created_date) as first_request,
        MAX(created_date) as last_request,
        COUNT(DISTINCT agency) as unique_agencies,
        COUNT(DISTINCT complaint_type) as unique_complaint_types
    FROM ${ref("products_db", "new_york_311_service_requests")}
    WHERE created_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
    GROUP BY COALESCE(borough, 'Unspecified')
),
borough_performance AS (
    SELECT
        borough,
        total_requests,
        resolved_requests,
        active_requests,
        SAFE_DIVIDE(resolved_requests, total_requests) * 100 as resolution_rate_percent,
        avg_resolution_days,
        CASE
            WHEN SAFE_DIVIDE(resolved_requests, total_requests) >= 0.9 THEN 'Excellent'
            WHEN SAFE_DIVIDE(resolved_requests, total_requests) >= 0.75 THEN 'Good'
            WHEN SAFE_DIVIDE(resolved_requests, total_requests) >= 0.5 THEN 'Fair'
            ELSE 'Needs Improvement'
        END as performance_category,
        CASE
            WHEN total_requests >= 50000 THEN 'High Volume'
            WHEN total_requests >= 10000 THEN 'Medium Volume'
            WHEN total_requests >= 1000 THEN 'Low Volume'
            ELSE 'Minimal Volume'
        END as volume_category
    FROM borough_metrics
)
SELECT
    bp.borough,
    bp.total_requests,
    bp.resolved_requests,
    bp.active_requests,
    ROUND(bp.resolution_rate_percent, 1) as resolution_rate_percent,
    ROUND(bm.avg_resolution_days, 1) as avg_resolution_days,
    bp.performance_category,
    bp.volume_category,
    bm.unique_agencies,
    bm.unique_complaint_types,
    bm.first_request,
    bm.last_request,
    DATE_DIFF(CURRENT_DATE(), bm.last_request, DAY) as days_since_last_request
FROM borough_performance bp
LEFT JOIN borough_metrics bm ON bp.borough = bm.borough

${ create(self(), factoryConfig).postSQL }
```

## 🔧 Advanced Configuration Examples

### High-Volume Service Requests with Optimization
```sql
-- definitions/models/nyc_311_high_volume.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["hourly", "civic_data", "high_volume"]
}

js {
    const { create, dateFilter } = require('includes/helpers');
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["unique_key"],
        partitionBy: "DATETIME_TRUNC(created_date, HOUR)",
        clusterBy: ["agency", "complaint_type", "borough", "status"],
        stagingDataset: "HighVolume_Staging",
        begin_daysBack: 0.5, // 12 hours only
        description: "High-volume NYC 311 data with hourly partitioning"
    }
}

${ create(self(), factoryConfig).preSQL }

SELECT *
FROM ${ref("products_db", "new_york_311_service_requests")}
WHERE ${dateFilter('created_date')}
    AND complaint_type IN ('Noise - Residential', 'Heat/Hot Water', 'Street Light Condition')

${ create(self(), factoryConfig).postSQL }
```

### Late-Arriving Data Pattern
```sql
-- definitions/models/nyc_311_with_lookback.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["daily", "civic_data", "late_data"]
}

js {
    const { create, dateFilter } = require('includes/helpers');
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["unique_key"],
        partitionBy: "DATE(created_date)",
        clusterBy: ["status", "borough"],
        begin_daysBack: 7,
        end_daysBack: 1, // Don't include today (incomplete)
        description: "NYC 311 requests with 7-day lookback for late arrivals"
    }
}

${ create(self(), factoryConfig).preSQL }

SELECT *
FROM ${ref("products_db", "new_york_311_service_requests")}
WHERE ${dateFilter('resolution_action_updated_date')}
    AND status != 'Draft'

${ create(self(), factoryConfig).postSQL }
```

### Monthly Aggregation with All Features
```sql
-- definitions/models/nyc_311_monthly_metrics.sqlx
config {
    schema: "Dev",
    type: "operations",
    hasOutput: true,
    tags: ["monthly", "metrics", "comprehensive"]
}

js {
    const { create } = require('includes/helpers');
    const factoryConfig = {
        type: "table",
        partitionBy: "report_month",
        clusterBy: ["borough", "metric_type", "agency_category"],
        description: "Monthly NYC 311 service metrics with comprehensive assertions",

        assertions: {
            materialized: true,
            data_quality: [
                { type: "not_null", column: "report_month" },
                { type: "not_null", column: "borough" },
                { type: "not_null", column: "metric_value" },
                { type: "unique_key", columns: ["report_month", "borough", "metric_type", "agency_category"] },
                { type: "accepted_values", column: "borough", values: ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND", "Citywide"] },
                { type: "accepted_values", column: "metric_type", values: ["TotalComplaints", "ResolvedComplaints", "AvgResolutionDays", "OpenComplaints"] },
                { type: "accepted_values", column: "agency_category", values: ["Public Safety", "Transportation", "Environment", "Housing", "Parks", "Other"] }
            ],
            business_rules: [
                { type: "freshness", dateColumn: "report_month", maxAgeHours: 168 },
                { type: "row_count", minRows: 50, maxRows: 1000 },
                { type: "percentage", condition: "metric_value >= 0", percentage: 100 },
                { type: "percentage", condition: "metric_value > 0", percentage: 85 }
            ]
        }
    }
}

${ create(self(), factoryConfig).preSQL }

WITH monthly_data AS (
    SELECT
        DATE_TRUNC(created_date, MONTH) as report_month,
        COALESCE(borough, 'Unspecified') as borough,
        CASE
            WHEN agency IN ('NYPD', 'FDNY') THEN 'Public Safety'
            WHEN agency IN ('DOT', 'TLC') THEN 'Transportation'
            WHEN agency IN ('DEP', 'DSNY', 'DEA') THEN 'Environment'
            WHEN agency IN ('HPD', 'DOB') THEN 'Housing'
            WHEN agency IN ('DPR') THEN 'Parks'
            ELSE 'Other'
        END as agency_category,
        'TotalComplaints' as metric_type,
        COUNT(*) as metric_value
    FROM ${ref("products_db", "new_york_311_service_requests")}
    WHERE created_date IS NOT NULL
    GROUP BY 1, 2, 3

    UNION ALL

    SELECT
        DATE_TRUNC(created_date, MONTH) as report_month,
        COALESCE(borough, 'Unspecified') as borough,
        CASE
            WHEN agency IN ('NYPD', 'FDNY') THEN 'Public Safety'
            WHEN agency IN ('DOT', 'TLC') THEN 'Transportation'
            WHEN agency IN ('DEP', 'DSNY', 'DEA') THEN 'Environment'
            WHEN agency IN ('HPD', 'DOB') THEN 'Housing'
            WHEN agency IN ('DPR') THEN 'Parks'
            ELSE 'Other'
        END as agency_category,
        'ResolvedComplaints' as metric_type,
        COUNT(CASE WHEN status = 'Closed' THEN 1 END) as metric_value
    FROM ${ref("products_db", "new_york_311_service_requests")}
    WHERE created_date IS NOT NULL
    GROUP BY 1, 2, 3
)
SELECT
    report_month,
    borough,
    agency_category,
    metric_type,
    metric_value,
    CURRENT_DATETIME() as created_at
FROM monthly_data

${ create(self(), factoryConfig).postSQL }
```

## 🧪 Testing Examples

### Comprehensive Assertion Testing
```sql
-- definitions/assertions/civic_data_quality_suite.sqlx
config {
    schema: "QualityOPs",
    type: "operations",
    hasOutput: true,
    tags: ["quality", "assertions", "civic_data"]
}

js {
    const { create } = require('includes/helpers');
    const factoryConfig = {
        type: "view",
        description: "NYC 311 data quality monitoring dashboard",

        assertions: {
            materialized: true,
            data_quality: [
                { type: "not_null", column: "table_name" },
                { type: "not_null", column: "check_result" },
                { type: "accepted_values", column: "check_result", values: ["PASS", "FAIL"] }
            ]
        }
    }
}

${ create(self(), factoryConfig).preSQL }

WITH quality_checks AS (
    SELECT 'nyc_311_service_requests' as table_name, 'unique_id' as check_type,
           CASE WHEN COUNT(*) = COUNT(DISTINCT unique_key) THEN 'PASS' ELSE 'FAIL' END as check_result
    FROM ${ref("products_db", "new_york_311_service_requests")}

    UNION ALL

    SELECT 'nyc_311_service_requests' as table_name, 'not_null_created_date' as check_type,
           CASE WHEN COUNT(*) = COUNT(created_date) THEN 'PASS' ELSE 'FAIL' END as check_result
    FROM ${ref("products_db", "new_york_311_service_requests")}

    UNION ALL

    SELECT 'nyc_311_service_requests' as table_name, 'valid_borough' as check_type,
           CASE WHEN COUNT(CASE WHEN borough NOT IN ('MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND')
                               AND borough IS NOT NULL THEN 1 END) = 0 THEN 'PASS' ELSE 'FAIL' END as check_result
    FROM ${ref("products_db", "new_york_311_service_requests")}
)
SELECT
    table_name,
    check_type,
    check_result,
    CURRENT_DATETIME() as check_timestamp
FROM quality_checks

${ create(self(), factoryConfig).postSQL }
```

## 📝 Pattern Summary

| Model Type | Use Case | Key Features |
|------------|----------|--------------|
| **Incremental** | High-volume service request data | MERGE operations, partition-aware, schema migration |
| **Table** | Monthly agency performance reports | Full refresh, optimized for analytics |
| **View** | Real-time civic dashboards | No storage cost, always current |

## 🔧 Configuration Options

### Common Options
- `uniqueKeys`: Primary key columns for MERGE operations (e.g., ["unique_key"])
- `partitionBy`: Partition column for performance (e.g., "DATE(created_date)")
- `clusterBy`: Clustering columns (max 4) (e.g., ["borough", "agency", "complaint_type"])
- `description`: Table/view description
- `assertions`: Data quality and business rule checks

### Incremental-Specific
- `begin_daysBack`: Days to look back for incremental processing
- `end_daysBack`: Days to exclude from processing
- `stagingDataset`: Custom staging dataset name
- `timestampInStagingName`: Include timestamp in staging table name for uniqueness (default: false)

### Assertion Options
- `materialized`: Create materialized assertion views
- `data_quality`: Standard data quality checks (not_null, unique_key, accepted_values)
- `business_rules`: Custom business rule validations (freshness, row_count, percentage)

### NYC 311 Specific Examples
- **Borough Values**: ["MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"]
- **Status Values**: ["Open", "Closed", "Pending", "In Progress", "Assigned"]
- **Agency Categories**: ["Public Safety", "Transportation", "Environment", "Housing", "Parks", "Other"]
- **Common Complaint Types**: ["Noise - Residential", "Heat/Hot Water", "Street Light Condition"]

These examples demonstrate the full power and flexibility of the Advanced Factory pattern with real NYC 311 civic data!