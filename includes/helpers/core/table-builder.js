/**
 * Dynamic table creation with advanced options
 */
class TableBuilder {
  
  /**
   * Generate CREATE TABLE statement with full configuration
   */
  static generateCreateTableSQL(targetTable, stagingTable, config) {
    let sql = `CREATE TABLE IF NOT EXISTS ${targetTable}`;
    
    // Add table options
    const options = this._buildTableOptions(config);
    if (options) {
      sql += `\n${options}`;
    }
    
    // Add description and labels
    const tableOptions = this._buildTableMetadata(config);
    if (tableOptions) {
      sql += `\n${tableOptions}`;
    }
    
    sql += `\nAS (\n  SELECT * FROM \`${stagingTable}\` WHERE FALSE\n)`;
    
    return sql;
  }

  /**
   * Build table options (partitioning, clustering, etc.)
   */
  static _buildTableOptions(config) {
    const options = [];
    
    if (config.partitionBy) {
      options.push(`PARTITION BY ${config.partitionBy}`);
    }
    
    if (config.clusterBy && config.clusterBy.length > 0) {
      options.push(`CLUSTER BY ${config.clusterBy.join(', ')}`);
    }
    
    return options.length > 0 ? options.join('\n') : '';
  }

  /**
   * Build table metadata (description, labels, etc.)
   */
  static _buildTableMetadata(config) {
    const options = [];
    
    if (config.description) {
      options.push(`description="${config.description}"`);
    }
    
    if (config.labels) {
      const labelPairs = Object.entries(config.labels)
        .map(([key, value]) => `("${key}", "${value}")`)
        .join(', ');
      options.push(`labels=[${labelPairs}]`);
    }
    
    if (config.partitionExpirationDays) {
      options.push(`partition_expiration_days=${config.partitionExpirationDays}`);
    }
    
    return options.length > 0 ? `OPTIONS(${options.join(', ')})` : '';
  }

  /**
   * Generate view creation SQL
   */
  static generateCreateViewSQL(viewName, selectSQL, config) {
    let sql = `CREATE OR REPLACE VIEW ${viewName}`;
    
    const options = this._buildTableMetadata(config);
    if (options) {
      sql += `\n${options}`;
    }
    
    sql += `\nAS (\n${selectSQL}\n)`;
    
    return sql;
  }

  /**
   * Generate materialized view creation SQL
   */
  static generateCreateMaterializedViewSQL(viewName, selectSQL, config) {
    let sql = `CREATE MATERIALIZED VIEW IF NOT EXISTS ${viewName}`;
    
    // Add partitioning/clustering for materialized views
    const options = this._buildTableOptions(config);
    if (options) {
      sql += `\n${options}`;
    }
    
    const metadata = this._buildTableMetadata(config);
    if (metadata) {
      sql += `\n${metadata}`;
    }
    
    sql += `\nAS (\n${selectSQL}\n)`;
    
    return sql;
  }
}

module.exports = { TableBuilder };
