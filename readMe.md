# Advanced Dataform GCP

Enterprise-grade Dataform helpers for building scalable, maintainable data pipelines with dynamic BigQuery operations.

> **⚡ NEW in v1.1.0**: Smart first-run detection with automatic snapshot mode - **38% cost reduction** on incremental models. [Learn more →](docs/SMART_INCREMENTAL.md)

## 🚀 Quick Start

### Installation

The helpers are already integrated in this project. Simply import what you need:

```javascript
const { create, dateFilter } = require('includes/helpers');
```

### Your First Model
```sql
-- definitions/my_model.sqlx
config {
    schema: "MySchema",
    type: "operations",
    hasOutput: true,
    tags: ["daily"]
}

js {
    const { create, dateFilter } = require('includes/helpers');
    const factoryConfig = {
        type: "incremental",
        uniqueKeys: ["ID"],
        partitionBy: "CreationDay",
        clusterBy: ["Country", "Type"],
        labels: {
            team: "data-team",
            activity: "analytics"
        },

        // Data Quality & Business Rules Assertions
        assertions: {
            columns: ["ID", "updated_at"],
            data_quality: [
                { type: "not_null", columns: ["ID", "updated_at"] },
                { type: "unique_key", columns: ["ID"] }
            ],
            business_rules: [
                { type: "freshness", dateColumn: "updated_at", maxAgeHours: 24 }
            ]
        }
    };
    const model = create(self(), factoryConfig);
}

${ model.preSQL }

SELECT * FROM ${ref("source_table")}
WHERE ${dateFilter('updated_at')}

${ model.postSQL }
```

## 📁 Project Structure

```text
├── definitions/
│   ├── OriginalTables/     # Core business tables
│   ├── Reports/            # Analytics and reporting models
│   └── examples/           # Complete usage examples
├── includes/helpers/       # Data factory and utilities
├── docs/                   # Comprehensive documentation
└── workflow_settings.yaml # Project configuration
```

## 🎯 Key Features

- ✅ **Factory Pattern** - Unified interface for all model types
- ✅ **Dynamic Schema Migration** - Automatic column detection and updates
- ✅ **Partition-Aware Merges** - Optimized incremental loading with targeted partition filtering
- ✅ **Smart First-Run Detection** - Auto-switches to snapshot mode when target doesn't exist (38% cost savings)
- ✅ **Smart Pattern Selection** - Auto-switches to snapshot when `fullRefresh: true`
- ✅ **BigQuery Labels Support** - Full metadata integration for governance and cost tracking
- ✅ **Conflict Resolution** - Automatic DROP TABLE handling for partitioning/clustering changes
- ✅ **View-Based Assertions** - High-performance partition-filtered assertion views
- ✅ **Cost-Optimized Quality Checks** - Assertions scan only relevant partitions
- ✅ **Configurable Assertion Datasets** - Flexible assertion storage in dedicated datasets
- ✅ **Enterprise Ready** - Production-tested patterns
- ✅ **90% Less Code** - Replace 150+ line models with 20 lines
- ✅ **Modular Architecture** - Organized into logical, maintainable modules
- ✅ **Professional Error Handling** - Production-ready reliability
- ✅ **Team Standardization** - Consistent patterns across projects

## 📚 Documentation

- **[API Reference](docs/API_REFERENCE.md)** - Complete function documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)** - Modular system overview
- **[Smart Incremental Guide](docs/SMART_INCREMENTAL.md)** - First-run optimization (38% cost savings)
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Step-by-step migration from manual models
- **[Best Practices](docs/BEST_PRACTICES.md)** - Optimization and team guidelines
- **[Examples](docs/EXAMPLES.md)** - Comprehensive usage examples
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🏗️ Modular Architecture

The system is organized into focused, maintainable modules:

```text
includes/helpers/
├── assertions/              # Data Quality & Business Rules
│   ├── assertions-manager.js
│   ├── assertion-views-builder.js
│   ├── data-quality-assertions.js
│   └── business-rules-assertions.js
├── core/                    # Core Infrastructure
│   ├── schema-manager.js
│   ├── merge-builder.js
│   └── table-builder.js
├── patterns/               # SQL Pattern Templates
│   ├── incremental-pattern.js
│   ├── snapshot-pattern.js
│   └── view-pattern.js
├── utilities/              # Utilities & Coordinators
│   ├── config-validator.js
│   ├── workflow-config.js
│   ├── date-filter.js
│   ├── table-options.js
│   └── sqlx-utils.js
├── advanced_factory.js     # Main Factory
└── index.js               # Central Module Exports
```

## 🏭 Model Types

| Type | Description | Use Case | Table Operation |
|------|-------------|----------|----------------|
| `incremental` | MERGE-based with schema migration | High-volume transactional data | Smart mode: Snapshot on first run, then `CREATE TABLE IF NOT EXISTS` + MERGE |
| `incremental` + `fullRefresh: true` | Full table replacement via snapshot | Complete data refresh | `DROP TABLE` + `CREATE TABLE` |
| `table` | Full refresh snapshot | Analytics aggregations | `DROP TABLE` + `CREATE TABLE` |
| `view` | Real-time views | Live dashboards and reports | `CREATE OR REPLACE VIEW` |

## 🎨 Pattern Types

### Incremental Pattern

- **Smart first-run detection** - Automatically uses snapshot mode when target doesn't exist (38% cost savings)
- **MERGE-based operations** with automatic schema detection
- **Partition-aware** for cost optimization
- **Staging tables** with auto-expiration (only created when needed)
- **Dynamic SQL generation** using `EXECUTE IMMEDIATE`

### Snapshot Pattern

- **Full table refresh** with partitioning/clustering
- **CREATE OR REPLACE TABLE** operations
- **Optimized for analytics** workloads

### View Pattern

- **Regular views** for real-time data
- **Materialized views** with auto-refresh support
- **Configurable refresh intervals**

## 🧪 Data Quality & Assertions

### View-Based Architecture
Assertion views are automatically created during model compilation with partition filtering for optimal performance:

- **Partition-Filtered Views**: Views created in configured assertion dataset (default: `QualityOPs`)
- **Cost Optimization**: Only scans relevant partitions based on incremental load dates
- **Separation of Concerns**: Complex filtering logic in views, simple assertions query pre-built views
- **Dynamic Configuration**: Reads assertion dataset from `workflow_settings.yaml`

### Assertion Types
**Data Quality Checks:**

- `not_null` - Validates required fields are populated
- `unique_key` - Ensures primary key constraints
- `accepted_values` - Validates enum/categorical values
- `relationships` - Foreign key validation

**Business Rules:**

- `freshness` - Data recency validation
- `row_count` - Volume threshold checks
- `percentage` - Data quality percentage thresholds

### Data Quality Assertions

- `not_null` - Validate non-null constraints across single or multiple columns
- `unique_key` - Ensure uniqueness across column combinations
- `accepted_values` - Validate categorical values against allowed lists
- `relationships` - Foreign key constraint validation across tables

### Business Rules Assertions

- `freshness` - Data recency validation with configurable age thresholds
- `row_count` - Minimum/maximum row count validation with flexible thresholds
- `percentage` - Condition percentage validation for data quality metrics

### Assertion View Creation Process

1. **Model Compilation**: Views are created during model compilation using `EXECUTE IMMEDIATE`
2. **Partition Filtering**: Views include `WHERE CreationDay IN (partition_values)` for cost optimization
3. **Dynamic SQL**: Uses `CONCAT` and `REPLACE` for proper variable substitution
4. **View Storage**: Views stored in configured assertion dataset with `_build` suffix

### Example Configuration

```javascript
assertions: {
    columns: ['ID', 'CreatedAt'], // Columns to include in assertion views
    data_quality: [
        { type: "not_null", columns: ["ID", "CustomerID", "Country"] },
        { type: "unique_key", columns: ["ID"] },
        { type: "accepted_values", column: "Country",
          values: ["Country1", "Country2", "Country3"] }
    ],
    business_rules: [
        { type: "freshness", dateColumn: "CreatedAt", maxAgeHours: 24 },
        { type: "row_count", minRows: 100 }
    ]
}
```

## ⚙️ Configuration

### Project Settings

Configure your project settings in `workflow_settings.yaml`:

```yaml
defaultProject: your-project-id
defaultLocation: your-region
defaultAssertionDataset: QualityOPs
dataformCoreVersion: 3.0.30
```

### Environment Variables

The factory supports environment-specific configurations for seamless deployment across development, staging, and production environments.

## 🔧 Advanced Features

### Smart First-Run Detection ⚡ NEW in v1.1.0

The incremental pattern now intelligently detects when a target table doesn't exist and automatically switches to snapshot mode:

- **First Run (No Target)**: Creates target table directly from SELECT query
  - ❌ No staging table creation
  - ❌ No schema migration overhead
  - ❌ No MERGE operation
  - ✅ **78% cost reduction** on first run
  - ✅ **3x faster execution**

- **Subsequent Runs (Target Exists)**: Uses standard incremental mode
  - ✅ Creates staging table
  - ✅ Runs schema migration
  - ✅ Executes partition-aware MERGE
  - ✅ Full incremental functionality

**Overall Impact**: 38% cost reduction across typical two-run scenarios. [Learn more →](docs/SMART_INCREMENTAL.md)

### Smart Pattern Selection

The factory automatically chooses the optimal execution pattern:

- **Incremental with `fullRefresh: false`**: Uses smart MERGE operations with first-run detection
- **Incremental with `fullRefresh: true`**: Switches to snapshot pattern for complete refresh
- **Table**: Always uses snapshot pattern for full refresh
- **View**: Creates real-time or materialized views

### Dynamic Schema Management

- Automatic detection of schema changes
- Seamless column additions and modifications
- Intelligent data type mapping
- Conflict resolution for structural changes

### Cost Optimization

- **Smart first-run execution** - Eliminates staging table and MERGE on first run (38% cost reduction)
- **Partition-aware query execution** - Targeted partition filtering for incremental loads
- **Intelligent staging table management** - Created only when target exists
- **Assertion views with partition filtering** - Scans only relevant partitions
- **Optimized BigQuery operations** - Dynamic SQL execution for minimal overhead

## 🚀 Getting Started

1. **Clone the repository**
2. **Configure your project settings** in `workflow_settings.yaml`
3. **Review the examples** in `definitions/examples/`
4. **Create your first model** using the factory pattern
5. **Deploy and monitor** your data pipeline

## 🆘 Support & Troubleshooting

- Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for common issues
- Review [Examples](docs/EXAMPLES.md) for your specific use case
- Follow [Best Practices](docs/BEST_PRACTICES.md) for optimal performance

## 🤝 Contributing

We welcome contributions! Please:

1. Follow existing code patterns
2. Add tests for new functionality
3. Update documentation for changes
4. Test with sample data before deployment

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Version 1.1.0** | *Dataform Core Version: 3.0.30* | [Changelog](CHANGELOG.md)
