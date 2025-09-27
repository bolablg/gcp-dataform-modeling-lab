# Troubleshooting Guide

Common issues and solutions when using the Advanced Factory pattern.

## 🚨 Common Errors

### 1. Schema Detection Failures

**Error:** `Table not found in schema detection`

**Causes:**
- Missing table permissions
- Incorrect table name reference
- Staging dataset doesn't exist

**Solutions:**
```sql
-- Check table exists
SELECT table_name FROM `project.dataset.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'your_table_name';

-- Verify permissions
SELECT * FROM `project.dataset.your_table` LIMIT 1;

-- Create staging dataset if missing
CREATE SCHEMA IF NOT EXISTS `project.Staging`;
```

### 2. MERGE Key Mismatches

**Error:** `Column not found in MERGE operation`

**Causes:**
- Unique key column doesn't exist in source data
- Case sensitivity issues
- Data type mismatches

**Solutions:**
```sql
-- Verify column exists in source
DESCRIBE ${ref("your_source_table")};

-- Check column names match exactly (case-sensitive)
SELECT column_name FROM `project.dataset.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'your_table' AND column_name = 'your_column';

-- Fix case sensitivity in factoryConfig
const factoryConfig = {
  type: "incremental",
  uniqueKeys: ["Transaction_ID"]  // Match exact case
}
```

### 3. Date Filter Issues

**Error:** `Column 'updated_at' not found`

**Causes:**
- Date column has different name
- Column doesn't exist in source table
- Date column is not a datetime type

**Solutions:**
```sql
-- Use correct column name
WHERE ${dateFilter('your_actual_date_column')}

-- Check available date columns
SELECT column_name, data_type FROM `project.dataset.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'your_table' AND data_type LIKE '%DATE%';
```

### 4. Partition Pruning Not Working

**Error:** High query costs, scanning full table

**Causes:**
- WHERE clause not using partition column
- Partition column not in correct format
- Filter conditions not partition-aligned

**Solutions:**
```sql
-- Ensure WHERE clause uses partition column
WHERE ${dateFilter('created_at')}  -- ✅ Good
-- This generates: DATE(created_at) BETWEEN beginDate AND limitDate

-- Check partition column format
SELECT
  partition_id,
  total_rows
FROM `project.dataset.INFORMATION_SCHEMA.PARTITIONS`
WHERE table_name = 'your_table';

-- Use appropriate partition expressions
const factoryConfig = {
  type: "incremental",
  partitionBy: "DATE(created_at)",        // For TIMESTAMP columns
  // partitionBy: "created_date",         // For DATE columns
  // partitionBy: "DATETIME_TRUNC(ts, DAY)" // For custom partitioning
}
```

### 5. Assertion View Creation Failures

**Error:** `Cannot create assertion view in QualityOPs dataset`

**Causes:**
- Missing permissions for QualityOPs dataset
- Invalid assertion configuration
- Column references don't exist

**Solutions:**
```sql
-- Create QualityOPs dataset if missing
CREATE SCHEMA IF NOT EXISTS `project.QualityOPs`;

-- Grant permissions
GRANT `roles/bigquery.dataEditor` ON SCHEMA `project.QualityOPs` TO 'your-service-account';

-- Check assertion column references
const factoryConfig = {
  assertions: {
    data_quality: [
      { type: "not_null", column: "existing_column_name" }  // Must exist in target table
    ]
  }
}
```

## ⚠️ Performance Issues

### 1. Slow Merge Operations

**Symptoms:** Long execution times, high slot usage

**Causes:**
- Large staging tables without proper filtering
- Missing or ineffective clustering
- Too many partition scans

**Solutions:**
```sql
-- Add selective filters to source query
js {
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["id"],
    clusterBy: ["most_filtered_column", "second_most_filtered"]
  }
}

${ create(self(), factoryConfig).preSQL }

SELECT * FROM ${ref("large_table")}
WHERE ${dateFilter('updated_at')}
  AND status = 'active'              -- Additional filters
  AND amount > 0                     -- Reduce data early

${ create(self(), factoryConfig).postSQL }

-- Reduce date window for very large tables
const factoryConfig = {
  type: "incremental",
  begin_daysBack: 1  // Instead of 2 or 3
}
```

### 2. Staging Table Conflicts

**Error:** `Table already exists` or `Permission denied`

**Causes:**
- Concurrent runs creating same staging table
- Insufficient permissions on staging dataset
- Previous run didn't cleanup properly

**Solutions:**
```sql
-- Advanced Factory automatically generates unique staging names
-- If issues persist, check staging dataset permissions:
GRANT `roles/bigquery.dataEditor` ON SCHEMA `project.Staging` TO 'your-service-account';

-- Manual cleanup if needed
DROP TABLE IF EXISTS `project.Staging.staging_table_*`;

-- Use different staging dataset for development
const factoryConfig = {
  type: "incremental",
  stagingDataset: "Dev_Staging"
}
```

### 3. Memory/Resource Errors

**Error:** `Resources exceeded` or `Query too complex`

**Causes:**
- Very large JOINs in source query
- Complex window functions
- Insufficient slot allocation

**Solutions:**
```sql
-- Break complex queries into stages
-- Stage 1: Base data (create as separate model)
-- Stage 2: Final model with JOINs

-- Simplify window functions in your SELECT
-- Pre-aggregate data where possible

-- Use appropriate date windows
const factoryConfig = {
  type: "incremental",
  begin_daysBack: 1,  // Smaller window
  end_daysBack: 0
}
```

## 🔧 Configuration Issues

### 1. Clustering Column Limits

**Error:** `Too many clustering columns`

**Solution:**
```javascript
// ❌ Too many columns
const badConfig = {
  clusterBy: ['col1', 'col2', 'col3', 'col4', 'col5']
}

// ✅ Maximum 4 columns
const factoryConfig = {
  clusterBy: ['col1', 'col2', 'col3', 'col4']
}
```

### 2. Invalid Partition Expressions

**Error:** `Invalid partitioning expression`

**Solutions:**
```javascript
// ✅ Valid partition expressions
const factoryConfig = {
  partitionBy: "DATE(created_at)"           // TIMESTAMP to DATE
  // partitionBy: "created_date"            // Already DATE column
  // partitionBy: "DATETIME_TRUNC(ts, DAY)" // DATETIME to DAY
  // partitionBy: "_PARTITIONTIME"          // Ingestion time
}

// ❌ Invalid expressions
const badConfig = {
  partitionBy: "created_at"                 // TIMESTAMP without DATE()
  // partitionBy: "UPPER(country)"          // Non-date expression
}
```

### 3. Reference Resolution Issues

**Error:** `Cannot resolve reference`

**Causes:**
- Typo in ref() function
- Referenced table doesn't exist
- Missing dependency declaration

**Solutions:**
```sql
-- Check reference syntax
${ref("schema", "table_name")}     -- ✅ Correct
${ref("table_name")}               -- ✅ Default schema
${ref("wrong_table")}              -- ❌ Typo

-- Verify table exists in Dataform
-- Check dataform.json includes path
{
  "includes": ["includes/**/*.js"]
}

-- Add explicit dependencies if needed
config({
  dependencies: ["schema.referenced_table"]
})
```

## 📊 Data Quality Issues

### 1. Assertion Failures

**Error:** `Assertion failed: Unique constraint violation`

**Debug Steps:**
```sql
-- Find duplicate records
SELECT id, COUNT(*) as cnt
FROM ${ref("your_table")}
GROUP BY id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- Check data source for duplicates
SELECT * FROM ${ref("source_table")}
WHERE id IN (SELECT id FROM duplicate_ids)
ORDER BY id, updated_at;

-- Add deduplication logic if needed
SELECT * EXCEPT(row_num)
FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) as row_num
  FROM source_data
)
WHERE row_num = 1
```

### 2. Row Count Discrepancies

**Issue:** Expected vs actual row counts don't match

**Debug Steps:**
```sql
-- Compare source vs target counts
SELECT 'source' as table_name, COUNT(*) as row_count
FROM ${ref("source_table")}
WHERE ${dateFilter('updated_at')}

UNION ALL

SELECT 'target' as table_name, COUNT(*) as row_count
FROM ${ref("target_table")}
WHERE ${dateFilter('created_at')};

-- Check for filtering conditions
-- Make sure WHERE clauses in source query match expectations
```

### 3. Materialized Assertion Performance

**Issue:** Assertion views taking too long to create

**Solutions:**
```javascript
// Use materialized assertions sparingly
const factoryConfig = {
  assertions: {
    materialized: false,  // Default to views for faster execution
    data_quality: [
      { type: "not_null", column: "id" }
    ]
  }
}

// Only materialize for critical assertions
const factoryConfig = {
  assertions: {
    materialized: true,  // Only for important quality checks
    data_quality: [
      { type: "unique_key", columns: ["unique_key"] }  // Critical check
    ]
  }
}
```

## 🛠️ Development & Debugging

### 1. Testing with Small Data Sets

**Strategy:** Test logic before full data processing

```sql
-- Add temporary filter for testing
WHERE DATE(created_date) = '2024-01-01'  -- Single day
-- Remove filter after testing

-- Or use LIMIT for quick tests
SELECT * FROM ${ref("large_source")}
WHERE ${dateFilter('created_date')}
LIMIT 1000  -- Remove after testing
```

### 2. Compilation Issues

**Error:** `Syntax error in generated SQL`

**Debug Steps:**
```bash
# Compile and check generated SQL
dataform compile

# Check the compiled output in .dataform/compiled folder
# Look for syntax errors in the generated SQL

# Test individual components
dataform compile --dry-run
```

### 3. Import Resolution

**Error:** `Cannot find module 'includes/helpers'`

**Solutions:**
```javascript
// Check dataform.json includes
{
  "includes": ["includes/**/*.js"]
}

// Verify file structure
includes/
  helpers/
    index.js          // Central export file
    advanced_factory.js  // Main factory

// Ensure index.js exports correctly
module.exports = {
  create: require('./advanced_factory.js').create,
  dateFilter: require('./advanced_factory.js').dateFilter
};
```

## 🚨 Emergency Procedures

### 1. Rollback Failed Deployment

```sql
-- 1. Immediately stop running queries
-- 2. Restore from backup if available
CREATE OR REPLACE TABLE current_table AS
SELECT * FROM backup_table_20240101;

-- 3. Revert to previous model version
-- Keep backup copies of working models

-- 4. Test thoroughly before re-deployment
```

### 2. Handle Corrupted Data

```sql
-- 1. Identify corrupted partition/date range
SELECT partition_id, COUNT(*)
FROM `project.dataset.INFORMATION_SCHEMA.PARTITIONS`
WHERE table_name = 'affected_table';

-- 2. Delete corrupted partitions
DELETE FROM target_table
WHERE DATE(partition_column) = 'corrupted_date';

-- 3. Re-run for specific date range
const factoryConfig = {
  type: "incremental",
  begin_daysBack: 1,  // Target specific date
  end_daysBack: 1
}
```

## 📞 Getting Help

### 1. Information to Gather

- Complete error message
- Advanced Factory configuration used
- Source table schema
- Data volume/size
- Dataform version

### 2. Useful Debug Queries

```sql
-- Table schema
SELECT * FROM `project.dataset.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'your_table';

-- Partition info
SELECT * FROM `project.dataset.INFORMATION_SCHEMA.PARTITIONS`
WHERE table_name = 'your_table';

-- Recent job history
SELECT * FROM `project.region-us.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
WHERE creation_time > DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 1 DAY)
ORDER BY creation_time DESC;

-- Check assertion views
SELECT table_name FROM `project.QualityOPs.INFORMATION_SCHEMA.TABLES`
WHERE table_name LIKE '%assertion%';
```

## 🔍 Common Advanced Factory Patterns

### Debug Compilation
```bash
# Check compiled SQL
dataform compile --json

# Dry run to validate
dataform run --dry-run

# Test specific model
dataform run --include-deps your_model_name
```

### Validate Configuration
```javascript
// Test configuration syntax
const { create } = require('includes/helpers');
const testConfig = {
  type: "incremental",
  uniqueKeys: ["id"],
  partitionBy: "DATE(created_at)"
};
// This should compile without errors
```

Remember: Most issues are configuration-related. Double-check factoryConfig structure, table names, column names, and permissions first!