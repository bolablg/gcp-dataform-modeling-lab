/**
 * Dependency management and resolution
 */
class DependencyResolver {
  
  /**
   * Generate ref() calls for dependencies
   */
  static generateDependencyRefs(dependencies) {
    return dependencies.map(dep => {
      if (typeof dep === 'string') {
        return this._parseRef(dep);
      } else {
        return this._parseRef(dep.schema, dep.table);
      }
    });
  }

  /**
   * Parse reference to table
   */
  static _parseRef(schema, table = null) {
    if (table) {
      return `\${ref("${schema}", "${table}")}`;
    } else {
      // Assume format is "schema.table" or just "table"
      const parts = schema.split('.');
      if (parts.length === 2) {
        return `\${ref("${parts[0]}", "${parts[1]}")}`;
      } else {
        return `\${ref("${schema}")}`;
      }
    }
  }

  /**
   * Validate dependencies exist
   */
  static validateDependencies(dependencies) {
    // Implementation would check if referenced tables exist
    // For now, return validation results
    return {
      valid: true,
      missing: [],
      warnings: []
    };
  }

  /**
   * Generate dependency graph
   */
  static generateDependencyGraph(models) {
    const graph = {};
    
    models.forEach(model => {
      graph[model.name] = {
        dependencies: model.dependencies || [],
        dependents: []
      };
    });
    
    // Build reverse dependencies
    Object.entries(graph).forEach(([modelName, modelInfo]) => {
      modelInfo.dependencies.forEach(dep => {
        if (graph[dep]) {
          graph[dep].dependents.push(modelName);
        }
      });
    });
    
    return graph;
  }

  /**
   * Detect circular dependencies
   */
  static detectCircularDependencies(models) {
    const graph = this.generateDependencyGraph(models);
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const hasCycle = (node) => {
      if (recursionStack.has(node)) {
        cycles.push(Array.from(recursionStack).concat(node));
        return true;
      }
      
      if (visited.has(node)) {
        return false;
      }
      
      visited.add(node);
      recursionStack.add(node);
      
      const dependencies = graph[node]?.dependencies || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };

    Object.keys(graph).forEach(node => {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    });

    return cycles;
  }
}

module.exports = { DependencyResolver };
