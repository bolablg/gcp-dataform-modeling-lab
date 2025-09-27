# Migration Guide

Step-by-step guide to migrate from manual MERGE operations to the Advanced Factory pattern.

## 📊 Before vs After Comparison

### Manual Approach (Before)
```sql
-- Your current 150+ line model
config { schema: "CivicData", type: "operations", hasOutput: true }

DECLARE beginDate DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY);
DECLARE limitDate DEFAULT CURRENT_DATE();
DECLARE update_set STRING;
-- ... 140+ more lines of complex schema detection and merge logic
```

### Advanced Factory Approach (After)
```sql
-- New 20-line model with same functionality
config { schema: "CivicData", type: "operations", hasOutput: true }

js {
  const { create, dateFilter } = require('includes/helpers');
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["unique_key"],
    partitionBy: "DATE(created_date)",
    clusterBy: ["borough", "agency"]
  }
}

${ create(self(), factoryConfig).preSQL }

-- Your existing SELECT statement (unchanged)
SELECT unique_key, agency, borough, ... FROM ${ref("products_db", "new_york_311_service_requests")} t
WHERE ${dateFilter('created_date')}

${ create(self(), factoryConfig).postSQL }
```

## 🔄 Migration Steps

### Step 1: Analyze Your Current Model

Identify these components in your existing model:

- **Unique keys** for MERGE operation
- **Partition column** (usually a date field)
- **Cluster columns** for query optimization
- **Date filtering logic** for incremental loads
- **Core SELECT statement** (your business logic)

### Step 2: Install Helpers

The Advanced Factory helpers are already included in this project. Simply import what you need:

```javascript
const { create, dateFilter } = require('includes/helpers');
```

### Step 3: Extract Your Business Logic

From your current model, extract only the SELECT statement:

**Keep This Part:**
```sql
SELECT
  unique_key,
  agency,
  DATE(created_date) as created_day,
  complaint_type,
  borough
FROM ${ref("products_db", "new_york_311_service_requests")} t
```

**Remove This Part:**
```sql
-- All the DECLARE statements
-- Schema detection CTE logic
-- EXECUTE IMMEDIATE statements
-- Manual MERGE building
-- Staging table management
```

### Step 4: Replace with Advanced Factory Pattern

Replace your entire model with the factory pattern:

```sql
config { schema: "CivicData", type: "operations", hasOutput: true }

js {
  const { create, dateFilter } = require('includes/helpers');
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["unique_key"],
    partitionBy: "DATE(created_date)",
    clusterBy: ["borough", "agency"],
    begin_daysBack: 2  // Adjust as needed
  }
}

${ create(self(), factoryConfig).preSQL }

-- Paste your extracted SELECT statement here
SELECT ... FROM ${ref("source")} ...
WHERE ${dateFilter('your_date_column')}

${ create(self(), factoryConfig).postSQL }
```

### Step 5: Configure Parameters

Map your current model settings to Advanced Factory configuration:

| Your Current Setting | Advanced Factory Configuration |
|---------------------|----------------------------|
| `['ID']` unique keys | `uniqueKeys: ["ID"]` |
| `CreationDay` partition | `partitionBy: "CreationDay"` |
| `['Country', 'Type']` cluster | `clusterBy: ["Country", "Type"]` |
| `INTERVAL 2 DAY` lookback | `begin_daysBack: 2` |
| `updated_at` filter column | `dateFilter('updated_at')` |

### Step 6: Test and Validate

1. **Compile first:**
   ```bash
   dataform compile
   ```

2. **Test on small dataset:**
   ```bash
   dataform run --tags=test
   ```

3. **Compare results:**
   - Row counts should match
   - Data should be identical
   - Performance should be same or better

## 🔧 Common Migration Patterns

### Pattern 1: Simple Incremental Table
```sql
-- Before: Complex manual MERGE
-- After: Simple Advanced Factory pattern
js {
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["id"],
    partitionBy: "date_column"
  }
}

${ create(self(), factoryConfig).preSQL }
-- Your SELECT here
${ create(self(), factoryConfig).postSQL }
```

### Pattern 2: Multi-Key MERGE
```sql
-- Before: Complex join conditions
-- After: Multiple unique keys
js {
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["agency", "unique_key"],
    partitionBy: "DATE(created_date)"
  }
}
```

### Pattern 3: Custom Date Filtering
```sql
-- Before: Manual date logic
-- After: Configurable date windows
WHERE ${dateFilter('custom_date_column')}

-- Or with different lookback period:
js {
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["id"],
    begin_daysBack: 7  // 7 days instead of 2
  }
}
```

### Pattern 4: With Assertions
```sql
js {
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["unique_key"],
    partitionBy: "DATE(created_date)",

    assertions: {
      materialized: true,
      data_quality: [
        { type: "unique_key", columns: ["unique_key"] },
        { type: "not_null", column: "agency" }
      ],
      business_rules: [
        { type: "row_count", minRows: 1000 },
        { type: "freshness", dateColumn: "created_date", maxAgeHours: 24 }
      ]
    }
  }
}
```

## ⚠️ Migration Gotchas

### 1. Table Names
- Factory uses `self()` - ensure this matches your current table name
- Staging tables get automatic unique names

### 2. Date Filtering
- Default is `DATE(created_date) BETWEEN beginDate AND limitDate`
- Adjust the column name if yours is different

### 3. Partition Columns
- Must exist in your SELECT statement
- Should be the same as your current partition strategy

### 4. Unique Keys
- Must be the same as your current MERGE keys
- Case-sensitive column names

### 5. Model Types
- All models now use `type: "operations"`
- The `factoryConfig.type` controls the actual behavior

## 🧪 Testing Checklist

Before deploying your migrated model:

- [ ] Model compiles without errors
- [ ] Row counts match original model
- [ ] Data content is identical
- [ ] Partition strategy is preserved
- [ ] Cluster columns are correct
- [ ] Performance is acceptable
- [ ] Dependencies still work
- [ ] Assertion views are created correctly

## 🚨 Rollback Plan

If issues arise:

1. Keep your original model as `model_name_backup.sqlx`
2. Test new model with different name first
3. Switch naming only after validation
4. Monitor for 24-48 hours after migration

## 📈 Expected Benefits

After migration:

- **90% less code** - From 150+ lines to ~20 lines
- **Easier maintenance** - Schema changes handled automatically
- **Better performance** - Optimized partition handling
- **Standardization** - Consistent patterns across team
- **Error reduction** - Professional error handling
- **Data quality** - Built-in assertion framework
- **Team collaboration** - Clean, readable code patterns

## 🔄 Migration Examples

### Example 1: Basic Transaction Table

**Before:**
```sql
-- 150+ lines of manual MERGE logic
```

**After:**
```sql
config { schema: "CivicData", type: "operations", hasOutput: true }

js {
  const { create, dateFilter } = require('includes/helpers');
  const factoryConfig = {
    type: "incremental",
    uniqueKeys: ["unique_key"],
    partitionBy: "DATE(created_date)",
    clusterBy: ["borough", "status"]
  }
}

${ create(self(), factoryConfig).preSQL }

SELECT
  unique_key,
  agency,
  complaint_type,
  status,
  borough,
  created_date
FROM ${ref("products_db", "new_york_311_service_requests")}
WHERE ${dateFilter('created_date')}

${ create(self(), factoryConfig).postSQL }
```

### Example 2: Customer Metrics with Assertions

**Before:**
```sql
-- Manual schema detection and complex MERGE
```

**After:**
```sql
config { schema: "CivicData", type: "operations", hasOutput: true }

js {
  const { create } = require('includes/helpers');
  const factoryConfig = {
    type: "table",
    clusterBy: ["borough", "agency_category"],
    description: "Daily service request metrics snapshot",

    assertions: {
      materialized: true,
      data_quality: [
        { type: "not_null", column: "agency" },
        { type: "unique_key", columns: ["agency", "report_date"] }
      ],
      business_rules: [
        { type: "row_count", minRows: 100 }
      ]
    }
  }
}

${ create(self(), factoryConfig).preSQL }

SELECT
  agency,
  agency_category,
  borough,
  total_requests,
  resolution_rate,
  CURRENT_DATE() as report_date
FROM ${ref("agency_metrics")}

${ create(self(), factoryConfig).postSQL }
```

## 🎯 Next Steps

After successful migration:

1. **Monitor performance** for the first week
2. **Add assertions** for data quality
3. **Standardize patterns** across your team
4. **Document your specific configurations** for future models
5. **Train team members** on the new patterns

The Advanced Factory pattern will significantly reduce your maintenance overhead while improving code quality and team productivity.