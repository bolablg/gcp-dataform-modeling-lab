/**
 * Advanced schema detection and management
 */
class SchemaManager {
  
  /**
   * Generate dynamic schema detection SQL
   */
  static generateSchemaSQL(targetTable, stagingTable, uniqueKeys, options = {}) {
    const cleanTarget = targetTable.replace(/`/g, '');
    const tableParts = cleanTarget.split('.');
    const project = tableParts[0];
    const dataset = tableParts.length > 1 ? tableParts[1] : tableParts[0];
    const table = tableParts.length > 2 ? tableParts[2] : tableParts[1] || tableParts[0];
    
    const stagingParts = stagingTable.replace(/`/g, '').split('.');
    const stagingDataset = stagingParts[1];
    const stagingTableName = stagingParts[2];
    
    const keyColumnsStr = uniqueKeys.map(col => `'${col}'`).join(', ');
    const joinCondition = uniqueKeys.map(col => `target.${col} = source.${col}`).join(' AND ');
    
    return `
      WITH table_exists AS (
        SELECT COUNT(*) > 0 AS target_exists 
        FROM 
          \`${project}.${dataset}\`.INFORMATION_SCHEMA.TABLES 
        WHERE table_name = \'${table}\'
      ),
      target_columns AS (
        SELECT column_name, data_type, is_nullable, column_default
        FROM 
          \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = \'${table}\'
        ORDER BY ordinal_position
      ),
      staging_columns AS (
        SELECT column_name, data_type, is_nullable, column_default
        FROM 
          \`${project}.${stagingDataset}\`.INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = \'${stagingTableName}\'
        ORDER BY ordinal_position
      ),
      final_columns AS (
        SELECT 
          CASE 
            WHEN (SELECT target_exists FROM table_exists) 
            THEN target_columns.column_name 
            ELSE staging_columns.column_name 
          END AS column_name,
          CASE 
            WHEN (SELECT target_exists FROM table_exists) 
            THEN target_columns.data_type 
            ELSE staging_columns.data_type 
          END AS data_type
        FROM staging_columns 
        LEFT JOIN target_columns ON staging_columns.column_name = target_columns.column_name
        WHERE 
          CASE 
            WHEN (SELECT target_exists FROM table_exists) 
            THEN target_columns.column_name IS NOT NULL 
            ELSE TRUE 
          END
      ),
      update_columns AS (
        SELECT column_name 
        FROM final_columns 
        WHERE column_name NOT IN (${keyColumnsStr}) 
          AND column_name IS NOT NULL
      ),
      all_columns AS (
        SELECT column_name 
        FROM final_columns 
        WHERE column_name IS NOT NULL
      )
      SELECT 
        (SELECT STRING_AGG(column_name || ' = source.' || column_name, ', ') FROM update_columns) AS update_set,
        (SELECT STRING_AGG(column_name, ', ') FROM all_columns) AS insert_cols,
        (SELECT STRING_AGG('source.' || column_name, ', ') FROM all_columns) AS insert_vals,
        '${joinCondition}' AS join_condition
        -- Target table existence check omitted for performance
    `;
  }

  /**
   * Get staging table name
   */
  static getStagingTableName(targetTable, stagingDataset = 'Staging', includeTimestamp = false) {
    const cleanTarget = targetTable.replace(/`/g, '');
    const tableParts = cleanTarget.split('.');
    const project = tableParts[0];
    const table = tableParts.length > 2 ? tableParts[2] : tableParts[1] || tableParts[0];

    let stagingTable = `${tableParts[1]}_${table}`;

    if (includeTimestamp) {
      const timestamp = Date.now();
      stagingTable += `_${timestamp}`;
    }

    return `${project}.${stagingDataset}.${stagingTable}`;
  }

  /**
   * Parse table reference
   */
  static parseTableReference(tableRef) {
    const cleanRef = tableRef.replace(/`/g, '');
    const parts = cleanRef.split('.');
    
    return {
      project: parts[0],
      dataset: parts.length > 1 ? parts[1] : parts[0],
      table: parts.length > 2 ? parts[2] : parts[1] || parts[0],
      full: cleanRef
    };
  }

  /**
   * Generate schema migration SQL
   */
  static generateSchemaMigrationSQL(targetTable, stagingTable) {
    const cleanTarget = targetTable.replace(/`/g, '');
    const tableParts = cleanTarget.split('.');
    const project = tableParts[0];
    const dataset = tableParts[1];
    const table = tableParts[2];

    const stagingParts = stagingTable.replace(/`/g, '').split('.');
    const stagingDataset = stagingParts[1];
    const stagingTableName = stagingParts[2];

    return `
      -- SCHEMA MIGRATION: Find new columns and generate ALTER statements
      SET alter_statements = (
        SELECT ARRAY_AGG(
          FORMAT('ALTER TABLE \`%s.%s.%s\` ADD COLUMN %s %s', 
                 '${project}',
                 '${dataset}',
                 '${table}',
                 s.column_name,
                 s.data_type)
        )
        FROM (
          SELECT column_name, data_type 
          FROM 
            \`${project}.${stagingDataset}\`.INFORMATION_SCHEMA.COLUMNS 
          WHERE table_name = \'${stagingTableName}\'
        ) s
        LEFT JOIN (
          SELECT column_name 
          FROM 
            \`${project}.${dataset}\`.INFORMATION_SCHEMA.COLUMNS 
          WHERE table_name = '${table}'
        ) t
        ON s.column_name = t.column_name
        WHERE t.column_name IS NULL
      );

      -- SCHEMA MIGRATION: Execute the ALTER statements
      IF alter_statements IS NOT NULL THEN
        FOR stmt IN (SELECT s FROM UNNEST(alter_statements) AS s)
        DO
          EXECUTE IMMEDIATE stmt.s;
        END FOR;
      END IF;
    `;
  }
}

module.exports = { SchemaManager };
