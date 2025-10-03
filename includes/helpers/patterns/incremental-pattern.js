/**
 * Incremental Pattern Module
 * Handles complex incremental/MERGE operations with dynamic schema management
 * Features smart first-run detection that automatically uses snapshot pattern for cost optimization
 */

const { SchemaManager } = require('../core/schema-manager.js');
const { MergeBuilder } = require('../core/merge-builder.js');
const { TableBuilder } = require('../core/table-builder.js');
const { TableOptions } = require('../utilities/table-options.js');
const { AssertionViewsBuilder } = require('../assertions/assertion-views-builder.js');

class IncrementalPattern {

    /**
     * Generate incremental pattern with MERGE operations
     * @param {string} targetTable - Target table name
     * @param {Array|string} uniqueKeys - Unique key columns for MERGE
     * @param {object} config - Configuration object
     * @returns {object} Pattern result with preSQL, postSQL, and metadata
     */
    static generate(targetTable, uniqueKeys = ['ID'], config = {}) {
        const stagingTable = SchemaManager.getStagingTableName(
            targetTable,
            config.stagingDataset || 'Staging',
            config.timestampInStagingName // Now defaults to false in the method
        );

        const mergeConfig = {
            uniqueKeys,
            partitionBy: config.partitionBy || null,
            clusterBy: config.clusterBy || [],
            description: config.description || '',
            labels: config.labels || {},
            partitionExpirationDays: config.partitionExpirationDays
        };

        const mergeOp = MergeBuilder.generateMergeOperation(targetTable, stagingTable, mergeConfig);
        const createTableSQL = TableBuilder.generateCreateTableSQL(targetTable, stagingTable, mergeConfig);
        const schemaMigrationSQL = SchemaManager.generateSchemaMigrationSQL(targetTable, stagingTable);

        const begin_daysBack = config.begin_daysBack || 2;
        const end_daysBack = config.end_daysBack || 0;
        const partitionColumn = config.partitionBy;
        const isFullRefresh = config.fullRefresh || false;

        // Use placeholders for backticked names to avoid escaping issues.
        const stagingTablePlaceholder = '__STAGING_TABLE__';

        // Build variable declarations - skip date variables for full refresh
        const variableDeclarations = this._buildVariableDeclarations(
            isFullRefresh,
            begin_daysBack,
            end_daysBack,
            partitionColumn
        );

        const preSQL = this._buildPreSQL(
            variableDeclarations,
            stagingTablePlaceholder,
            targetTable,
            uniqueKeys,
            partitionColumn,
            isFullRefresh,
            config
        );

        const postSQL = this._buildPostSQL(
            createTableSQL,
            schemaMigrationSQL,
            mergeOp,
            stagingTablePlaceholder,
            targetTable,
            partitionColumn,
            config
        );

        // Replace placeholders with backticked names
        const finalPreSQL = preSQL.replace(new RegExp(stagingTablePlaceholder, 'g'), `${stagingTable}`);
        let finalPostSQL = postSQL.replace(new RegExp(stagingTablePlaceholder, 'g'), `${stagingTable}`);

        // Generate assertion views SQL (to be executed after the main model)
        const assertionViewsSQL = AssertionViewsBuilder.generateAssertionViews(
            targetTable,
            config,
            { metadata: { stagingTable } },
            { fullRefresh: isFullRefresh }
        );

        // Append assertion views creation to postSQL
        if (assertionViewsSQL) {
            finalPostSQL += `

-- 🔍 ASSERTIONS: Create partition-filtered views for data quality validation
${assertionViewsSQL}
`;
        }

        return {
            preSQL: finalPreSQL,
            postSQL: finalPostSQL,
            assertionViewsSQL, // Partition-filtered assertion views SQL
            metadata: {
                stagingTable,
                uniqueKeys,
                partitionColumn,
                targetTable
            }
        };
    }

    /**
     * Build variable declarations section
     * @private
     */
    static _buildVariableDeclarations(isFullRefresh, begin_daysBack, end_daysBack, partitionColumn) {
        const variableDeclarations = [];

        // Add target existence check variable
        variableDeclarations.push('DECLARE target_exists BOOL;');

        if (!isFullRefresh) {
            variableDeclarations.push(`DECLARE beginDate DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL ${begin_daysBack} DAY);`);
            variableDeclarations.push(`DECLARE limitDate DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL ${end_daysBack} DAY);`);
        }

        variableDeclarations.push(
            'DECLARE update_set STRING;',
            'DECLARE insert_cols STRING;',
            'DECLARE insert_vals STRING;',
            'DECLARE join_condition STRING;',
            'DECLARE merge_sql STRING;'
        );

        if (partitionColumn) {
            variableDeclarations.push('DECLARE partition_values STRING;');
        }

        variableDeclarations.push('DECLARE alter_statements ARRAY<STRING>;');

        return variableDeclarations;
    }

    /**
     * Build preSQL section with smart first-run detection
     * @private
     */
    static _buildPreSQL(variableDeclarations, stagingTablePlaceholder, targetTable, uniqueKeys, partitionColumn, isFullRefresh, config) {
        const tableParts = this._parseTableName(targetTable);
        const { project, dataset, table } = tableParts;

        // Build snapshot-style CREATE statement for first run
        const tableOptions = TableOptions.build(config);
        const metadata = TableBuilder._buildTableMetadata(config);
        const snapshotCreate = metadata
            ? `CREATE TABLE ${targetTable}${tableOptions}\n${metadata}`
            : `CREATE TABLE ${targetTable}${tableOptions}`;

        return `
/*
╔═══════════════════════════════════════════════════════════════╗
║              🔀 SMART INCREMENTAL PATTERN                    ║
╠═══════════════════════════════════════════════════════════════╣
║ Mode: ${isFullRefresh ? 'FULL REFRESH' : 'INCREMENTAL'.padEnd(12)} │ Keys: ${uniqueKeys.join(', ').padEnd(20)} ║
║ Partition: ${(partitionColumn || 'None').padEnd(18)} │ Generated: ${new Date().toISOString().split('T')[0]} ║
║ Smart Mode: Auto-switches to snapshot for first run          ║
╚═══════════════════════════════════════════════════════════════╝
*/

${variableDeclarations.join('\n')}
DECLARE create_sql STRING;

-- 🔍 CHECK: Determine if target table exists
SET target_exists = (
    SELECT COUNT(*) > 0
    FROM \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLES
    WHERE table_name = '${table}'
);

-- ========== BUILD CREATE STATEMENT DYNAMICALLY ==========
IF NOT target_exists THEN
    -- Branch 1: SNAPSHOT - Create target directly
    SET create_sql = """
        ${snapshotCreate}
        AS (
    """;
ELSE
    -- Branch 2: INCREMENTAL - Create staging table
    SET create_sql = """
        CREATE OR REPLACE TABLE ${stagingTablePlaceholder}
        OPTIONS(
          expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 12 HOUR)
        )
        AS (
    """;
END IF;

-- Execute the dynamic CREATE statement with the SELECT query
EXECUTE IMMEDIATE create_sql || """
      `;
    }

    /**
     * Parse table name into components
     * @private
     */
    static _parseTableName(targetTable) {
        const cleanTarget = targetTable.replace(/`/g, '');
        const tableParts = cleanTarget.split('.');
        return {
            project: tableParts[0],
            dataset: tableParts[1],
            table: tableParts[2],
            full: cleanTarget
        };
    }

    /**
     * Build postSQL section with conditional logic for snapshot vs incremental
     * @private
     */
    static _buildPostSQL(createTableSQL, schemaMigrationSQL, mergeOp, stagingTablePlaceholder, targetTable, partitionColumn, config) {
        return `
        )  -- Close the AS ( from CREATE statement
""";  -- Close the EXECUTE IMMEDIATE

-- ========== BRANCH 1: SNAPSHOT MODE (First Run) ==========
IF NOT target_exists THEN
    -- 📊 PARTITIONS: Extract partition values from newly created target table
    ${partitionColumn
      ? `SET partition_values = (
           SELECT STRING_AGG(DISTINCT CONCAT("'", ${partitionColumn}, "'"), ", ")
           FROM ${targetTable}
         );`
      : `-- No partition column specified`}

    /*
    ┌─────────────────────────────────────────────────────────────┐
    │ ✅ SNAPSHOT MODE COMPLETE (First Run)                      │
    │ • Target table created directly from SELECT                 │
    │ • No staging table or MERGE needed (50% cost savings!)     │
    │ • Partition values extracted for assertion views           │
    └─────────────────────────────────────────────────────────────┘
    */

-- ========== BRANCH 2: INCREMENTAL MODE (Subsequent Runs) ==========
ELSE
    -- 🏗️ TARGET: Ensure target table exists with proper schema
    ${createTableSQL};

    -- 🔄 SCHEMA: Migrate and sync column definitions
    ${schemaMigrationSQL}

    -- 📋 METADATA: Extract dynamic schema information
    EXECUTE IMMEDIATE FORMAT(""" %s """, """${mergeOp.schemaSQL}""")
    INTO update_set, insert_cols, insert_vals, join_condition;

    -- 📊 PARTITIONS: ${mergeOp.hasPartition ? 'Extract values for targeted merge' : 'No partition filtering needed'}
    ${mergeOp.hasPartition
      ? `SET partition_values = (
           SELECT STRING_AGG(DISTINCT CONCAT("'", ${partitionColumn}, "'"), ", ")
           FROM ${stagingTablePlaceholder}
         );`
      : `-- Partition values: Not applicable for this model`}

    -- 🔀 MERGE: Build and execute dynamic UPSERT operation
    SET merge_sql = FORMAT(""" ${mergeOp.mergeSQL} """,
      ${mergeOp.hasPartition ?
        `'${stagingTablePlaceholder}', join_condition, partition_values, update_set, insert_cols, insert_vals` :
        `'${stagingTablePlaceholder}', join_condition, update_set, insert_cols, insert_vals`}
    );

    -- ⚡ EXECUTE: Apply changes to target table
    EXECUTE IMMEDIATE merge_sql;

    /*
    ┌─────────────────────────────────────────────────────────────┐
    │ ✅ INCREMENTAL PROCESSING COMPLETE                         │
    │ • Staging table expires automatically in 12 hours          │
    │ • Partition values available for assertion view filtering   │
    └─────────────────────────────────────────────────────────────┘
    */
END IF;
      `;
    }
}

module.exports = { IncrementalPattern };