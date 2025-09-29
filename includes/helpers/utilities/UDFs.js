/**
 * UDFs (User Defined Functions) Class
 * Centralized utility functions for data transformations
 */
class UDFs {
    /**
     * Combine multiple strings, ignore nulls, return "" if all are null
     * @param {Array} strings - Array of strings to combine
     * @param {string} link - Separator string (default: " and ")
     * @returns {string} Combined string or empty string if all null
     */
    static combineNonNullStrings(strings, link = " and ") {
        const nonNullStrings = strings.filter(s => s != null);
        if (nonNullStrings.length === 0) {
            return "";
        }
        return nonNullStrings.join(link);
    }

    /**
     * Format a date string to a standardized format
     * @param {string|Date} date - Date to format
     * @param {string} format - Format string (default: 'YYYY-MM-DD')
     * @returns {string} Formatted date string
     */
    static formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return "";
        // Basic date formatting - can be expanded
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    /**
     * Clean and normalize text fields
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    static cleanText(text) {
        if (!text) return "";
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Generate a safe column name from a string
     * @param {string} name - Original name
     * @returns {string} Safe column name
     */
    static safeColumnName(name) {
        if (!name) return "";
        return name.toLowerCase()
                  .replace(/[^a-z0-9_]/g, '_')
                  .replace(/_{2,}/g, '_')
                  .replace(/^_|_$/g, '');
    }

    /**
     * Parse JSON safely with fallback
     * @param {string} jsonString - JSON string to parse
     * @param {any} defaultValue - Default value if parsing fails
     * @returns {any} Parsed object or default value
     */
    static safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            return defaultValue;
        }
    }
}

// Export the class
module.exports = { UDFs };