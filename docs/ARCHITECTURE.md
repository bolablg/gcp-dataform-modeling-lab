# Advanced Factory Architecture Guide

Comprehensive overview of the modular architecture and design principles.

## 🏗️ System Overview

The Advanced Factory is built on a modular, enterprise-grade architecture that separates concerns into logical, maintainable components. This design enables scalability, testability, and ease of maintenance.

## 📂 Directory Structure

```
includes/helpers/
├── assertions/              # Data Quality & Business Rules
│   ├── assertions-manager.js         # Central assertion coordinator
│   ├── data-quality-assertions.js    # not_null, unique_key, accepted_values, relationships
│   └── business-rules-assertions.js  # freshness, row_count, percentage
├── core/                    # Core Infrastructure Components
│   ├── dependency-resolver.js        # Dependency management utilities
│   ├── merge-builder.js             # Dynamic MERGE operation builder
│   ├── schema-manager.js            # Schema detection and migration
│   └── table-builder.js             # Table creation and management
├── patterns/               # SQL Pattern Templates
│   ├── incremental-pattern.js       # MERGE-based incremental loads
│   ├── snapshot-pattern.js          # Full table refresh operations
│   └── view-pattern.js              # View and materialized view creation
├── utilities/              # Cross-Cutting Utilities
│   ├── date-filter.js               # Date filtering strategies
│   ├── table-options.js             # BigQuery table options builder
│   └── sqlx-utils.js                # Pattern coordinator and utilities
├── advanced_factory.js        # Main Factory Entry Point
└── index.js               # Central Module Exports
```

## 🎯 Design Principles

### 1. Single Responsibility
Each module has a single, well-defined responsibility:
- **Assertions modules** handle only assertion logic
- **Pattern modules** focus solely on SQL pattern generation
- **Core modules** manage infrastructure concerns
- **Utility modules** provide reusable, stateless functions

### 2. Separation of Concerns
Clear boundaries between different types of functionality:
- **Data Quality** vs **Business Rules** assertions
- **Pattern Generation** vs **Infrastructure Management**
- **Configuration** vs **Execution Logic**

### 3. Dependency Inversion
High-level modules don't depend on low-level modules. Both depend on abstractions:
- `advanced_factory.js` delegates to specialized managers
- `sqlx-utils.js` coordinates pattern modules
- `assertions-manager.js` orchestrates assertion types

### 4. Open/Closed Principle
Open for extension, closed for modification:
- New assertion types can be added without changing existing code
- New patterns can be created without modifying core infrastructure
- Configuration options can be extended without breaking existing models

## 🔄 Data Flow

### Model Creation Flow

```
User SQLX Model
       ↓
advanced_factory.create()
       ↓
SQLXUtils (pattern selection)
       ↓
Pattern Module (incremental/snapshot/view)
       ↓
Core Infrastructure (schema/merge/table)
       ↓
Generated SQL (preSQL + postSQL)
       ↓
AssertionsManager (if configured)
       ↓
Assertion Modules (data_quality + business_rules)
       ↓
Complete Model Execution
```

### Assertion Generation Flow

```
advanced_factory.create()
       ↓
AssertionsManager.generateAssertions()
       ↓
┌─────────────────────────┬─────────────────────────┐
│ DataQualityAssertions   │ BusinessRulesAssertions │
│ - not_null              │ - freshness             │
│ - unique_key           │ - row_count             │
│ - accepted_values      │ - percentage            │
│ - relationships        │                         │
└─────────────────────────┴─────────────────────────┘
       ↓
Generated assert() Statements
       ↓
BigQuery Assertion Views in QualityOPs Dataset
```

## 🧩 Module Responsibilities

### Core Infrastructure (`core/`)

**schema-manager.js**
- Dynamic schema detection
- Column type inference
- Schema migration SQL generation
- Staging table name management

**merge-builder.js**
- Dynamic MERGE statement construction
- Partition-aware merge operations
- JOIN condition generation
- Conflict resolution strategies

**table-builder.js**
- CREATE TABLE SQL generation
- Partition and cluster configuration
- Table option management

**dependency-resolver.js**
- Dependency tracking and resolution
- Build order optimization

### Pattern Templates (`patterns/`)

**incremental-pattern.js**
- MERGE-based incremental loading
- Staging table management
- Dynamic variable declarations
- Partition filtering logic

**snapshot-pattern.js**
- Full table refresh patterns
- CREATE OR REPLACE TABLE operations
- Partition and cluster support

**view-pattern.js**
- Regular and materialized views
- Auto-refresh configuration
- Performance optimization options

### Assertion System (`assertions/`)

**assertions-manager.js**
- Central assertion coordination
- Table information parsing
- Partition filter building
- Configuration validation

**data-quality-assertions.js**
- not_null constraint validation
- unique_key integrity checks
- accepted_values validation
- relationship constraint verification

**business-rules-assertions.js**
- Data freshness monitoring
- Row count threshold validation
- Percentage condition checks
- Custom business rule support

### Utilities (`utilities/`)

**sqlx-utils.js**
- Pattern coordination and delegation
- Backward compatibility maintenance
- Utility function aggregation

**date-filter.js**
- Multiple date filtering strategies
- Variable-based and static filters
- Partition-aware filtering
- Timestamp precision handling

**table-options.js**
- BigQuery table options builder
- Partition and cluster configuration
- Description and expiration options
- Advanced option combinations

## 🔧 Extension Points

### Adding New Assertion Types

1. **Data Quality Assertion:**
   ```javascript
   // In data-quality-assertions.js
   static _generateCustomCheck(check, assertionColumnsList, tableRefForAssertions, partitionFilter) {
       const queries = [];
       // Implementation
       return queries;
   }
   ```

2. **Business Rule Assertion:**
   ```javascript
   // In business-rules-assertions.js
   static _generateCustomRule(check, assertionColumnsList, tableRefForAssertions, partitionFilter) {
       const queries = [];
       // Implementation
       return queries;
   }
   ```

### Adding New Pattern Types

1. **Create new pattern module:**
   ```javascript
   // patterns/custom-pattern.js
   class CustomPattern {
       static generate(targetTable, config = {}) {
           // Implementation
           return { preSQL, postSQL, metadata };
       }
   }
   ```

2. **Register in sqlx-utils.js:**
   ```javascript
   case 'custom':
       result.model = CustomPattern.generate(target, config);
       break;
   ```

### Adding New Utilities

1. **Create utility module:**
   ```javascript
   // utilities/custom-utility.js
   class CustomUtility {
       static doSomething(config) {
           // Implementation
       }
   }
   ```

2. **Export in index.js:**
   ```javascript
   const { CustomUtility } = require('./utilities/custom-utility.js');
   module.exports = { ..., CustomUtility };
   ```

## 🚀 Performance Characteristics

### Memory Efficiency
- **Stateless modules** - No persistent state between invocations
- **Lazy loading** - Modules loaded only when needed
- **Small footprint** - Each module focuses on specific functionality

### Execution Performance
- **Direct delegation** - Minimal overhead in factory pattern
- **Optimized SQL generation** - Pre-computed templates and patterns
- **Partition awareness** - Cost-effective BigQuery operations

### Maintenance Efficiency
- **Focused modules** - Easy to locate and modify specific functionality
- **Clear dependencies** - Explicit import/export relationships
- **Comprehensive testing** - Each module can be tested independently

## 🔒 Security Considerations

### SQL Injection Prevention
- **Parameterized queries** - Dynamic values properly escaped
- **Template-based generation** - Structured SQL construction
- **Input validation** - Configuration validation before processing

### Access Control
- **Dataset isolation** - Staging and assertion tables in separate datasets
- **Permission inheritance** - Follows BigQuery security model
- **Audit trail** - Generated SQL includes metadata comments

## 📊 Monitoring and Observability

### Generated Metadata
- **Creation timestamps** - All generated SQL includes generation time
- **Configuration tracking** - Comments include key configuration details
- **Pattern identification** - Clear marking of pattern types

### Error Handling
- **Graceful degradation** - Missing configurations use sensible defaults
- **Comprehensive validation** - Input validation with helpful error messages
- **Debugging support** - Verbose error messages with context

## 🔄 Migration Strategy

### From Legacy Models
1. **Identify pattern type** (incremental/snapshot/view)
2. **Extract configuration** from existing SQL
3. **Map to advanced_factory config** structure
4. **Add assertions** for data quality
5. **Test and validate** generated SQL

### Between Versions
- **Backward compatibility** maintained through interface stability
- **Deprecation warnings** for obsolete features
- **Migration utilities** for configuration updates
- **Documentation updates** with breaking change notifications

This modular architecture ensures the Advanced Factory remains maintainable, extensible, and performant while providing a clean, consistent interface for data engineers.