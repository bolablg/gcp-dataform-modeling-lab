/**
 * View Pattern Module
 * Handles real-time view creation (CREATE OR REPLACE VIEW)
 */

class ViewPattern {

    /**
     * Generate view pattern for real-time or materialized views
     * @param {string} viewName - Target view name
     * @param {object} config - Configuration object
     * @param {boolean} config.materialized - Whether to create a materialized view (default: false)
     * @param {string} config.description - View description
     * @param {boolean} config.autoRefresh - Enable auto refresh for materialized views (default: false)
     * @param {number} config.refreshInterval - Refresh interval in minutes for materialized views (default: 60)
     * @returns {object} Pattern result with preSQL and postSQL
     */
    static generate(viewName, config = {}) {
        const isMaterialized = config.materialized || false;

        if (isMaterialized) {
            return this.generateMaterialized(viewName, config);
        } else {
            return this._generateRegularView(viewName, config);
        }
    }

    /**
     * Generate regular (non-materialized) view
     * @private
     */
    static _generateRegularView(viewName, config = {}) {
        const description = config.description ? `
OPTIONS(description="${config.description}")` : '';

        const preSQL = this._buildPreSQL(viewName, description, false);
        const postSQL = this._buildPostSQL(false);

        return {
            preSQL: preSQL,
            postSQL: postSQL
        };
    }

    /**
     * Build preSQL section for view pattern
     * @private
     */
    static _buildPreSQL(viewName, description, isMaterialized = false) {
        const viewType = isMaterialized ? 'MATERIALIZED VIEW' : 'VIEW';
        const icon = isMaterialized ? '📊' : '👁️';

        return `
/*
┌───────────────────────────────────────────────────────────────┐
│                   ${icon} ${viewType.toUpperCase()} PATTERN                   │
│ Generated: ${new Date().toISOString().split('T')[0].padEnd(37)} │
└───────────────────────────────────────────────────────────────┘
*/

CREATE OR REPLACE ${viewType} ${viewName}${description}
AS (
      `;
    }

    /**
     * Build postSQL section for view pattern
     * @private
     */
    static _buildPostSQL(isMaterialized = false) {
        const viewType = isMaterialized ? 'MATERIALIZED VIEW' : 'VIEW';

        return `
);

/*
┌───────────────────────────────────────────────────────────────┐
│ ✅ ${viewType.toUpperCase()} CREATION COMPLETE                    │
└───────────────────────────────────────────────────────────────┘
*/
      `;
    }

    /**
     * Generate materialized view pattern
     * @param {string} viewName - Target materialized view name
     * @param {object} config - Configuration object
     * @returns {object} Pattern result with preSQL and postSQL
     */
    static generateMaterialized(viewName, config = {}) {
        const options = this._buildMaterializedViewOptions(config);
        const preSQL = this._buildPreSQL(viewName, options, true);
        const postSQL = this._buildPostSQL(true);

        return {
            preSQL: preSQL,
            postSQL: postSQL,
            metadata: {
                isMaterialized: true,
                autoRefresh: config.autoRefresh || false,
                refreshInterval: config.refreshInterval || 60
            }
        };
    }

    /**
     * Build materialized view options
     * @private
     */
    static _buildMaterializedViewOptions(config) {
        const options = [];

        // Add description if provided
        if (config.description) {
            options.push(`description="${config.description}"`);
        }

        // Add auto refresh settings if enabled
        if (config.autoRefresh) {
            options.push('enable_refresh=true');
            options.push(`refresh_interval_minutes=${config.refreshInterval || 60}`);
        }

        return options.length > 0 ? `\nOPTIONS(\n  ${options.join(',\n  ')}\n)` : '';
    }
}

module.exports = { ViewPattern };