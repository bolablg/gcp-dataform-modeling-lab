const { SchemaManager } = require('./schema-manager.js');

/**
 * Dynamic MERGE statement builder
 */
class MergeBuilder {
  
  /**
   * Generate complete merge operation
   */
  static generateMergeOperation(targetTable, stagingTable, config) {
    const schemaSQL = SchemaManager.generateSchemaSQL(
      targetTable,
      stagingTable,
      config.uniqueKeys
    );

    const partitionFilter = config.partitionBy ?
      this._generatePartitionFilter(stagingTable, config.partitionBy) : null;

    return {
      stagingTableName: stagingTable,
      schemaSQL: schemaSQL,
      mergeSQL: this._buildMergeSQL(targetTable, stagingTable, partitionFilter),
      partitionFilter: partitionFilter,
      hasPartition: !!config.partitionBy
    };
  }

  /**
   * Build the actual MERGE SQL statement
   */
  static _buildMergeSQL(targetTable, stagingTable, partitionFilter) {
    if (partitionFilter) {
      // With partition - 6 parameters: stagingTable, join_condition, partition_values, update_set, insert_cols, insert_vals
      return `
      MERGE ${targetTable} target
      USING (SELECT * FROM \`%s\`) source
      ON %s AND ${partitionFilter.targetExpression} IN (%s)
      WHEN MATCHED THEN
        UPDATE SET %s
      WHEN NOT MATCHED THEN
        INSERT (%s)
        VALUES (%s)
    `;
    } else {
      // Without partition - 5 parameters: stagingTable, join_condition, update_set, insert_cols, insert_vals
      return `
      MERGE ${targetTable} target
      USING (SELECT * FROM \`%s\`) source
      ON %s
      WHEN MATCHED THEN
        UPDATE SET %s
      WHEN NOT MATCHED THEN
        INSERT (%s)
        VALUES (%s)
    `;
    }
  }

  /**
   * Generate partition filter for incremental loads
   */
  static _generatePartitionFilter(stagingTable, partitionColumn) {
    // Determine if partitionColumn is an expression or simple column
    const isExpression = partitionColumn.includes('(') || partitionColumn.includes(' ');

    let targetPartitionExpression;
    if (isExpression) {
      // For expressions like DATE(created_at), we need to apply same expression to target
      // Replace column references with target.column_name
      targetPartitionExpression = partitionColumn.replace(/([a-zA-Z_]\w*)/g, (match) => {
        // Don't prefix SQL functions (uppercase words)
        if (match === match.toUpperCase()) {
          return match;
        }
        return `target.${match}`;
      });
    } else {
      // Simple column name
      targetPartitionExpression = `target.${partitionColumn}`;
    }

    return {
      column: partitionColumn,
      targetExpression: targetPartitionExpression,
      sql: `
        (
          SELECT STRING_AGG(DISTINCT CONCAT("'", ${partitionColumn}, "'"), ", ")
          FROM \`${stagingTable}\`
        )
      `
    };
  }

  /**
   * Generate MERGE with conflict resolution
   */
  static generateMergeWithConflictResolution(targetTable, stagingTable, config) {
    const baseSQL = this._buildMergeSQL(targetTable, stagingTable, null);
    
    if (config.conflictResolution === 'source_wins') {
      return baseSQL; // Default behavior
    } else if (config.conflictResolution === 'target_wins') {
      return baseSQL.replace(
        'UPDATE SET %s',
        'UPDATE SET updated_at = source.updated_at -- Target wins, only update timestamp'
      );
    }
    
    return baseSQL;
  }
}

module.exports = { MergeBuilder };
