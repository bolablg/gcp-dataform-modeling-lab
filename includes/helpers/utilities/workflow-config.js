/**
 * Workflow Configuration Helper
 * Uses Dataform's built-in configuration system instead of directly reading files
 */

class WorkflowConfig {

    /**
     * Get the assertion dataset - either from Dataform config or fallback to model schema
     * @param {string} modelSchema - The model's schema to use as fallback
     * @returns {string} Assertion dataset name
     */
    static getAssertionDataset(modelSchema) {
        // Try to use Dataform's built-in project config first
        try {
            if (typeof dataform !== 'undefined' && dataform.projectConfig) {
                // Try assertionSchema (CLI parameter)
                if (dataform.projectConfig.assertionSchema) {
                    return dataform.projectConfig.assertionSchema;
                }

                // Try defaultAssertionDataset (from workflow_settings.yaml)
                if (dataform.projectConfig.defaultAssertionDataset) {
                    return dataform.projectConfig.defaultAssertionDataset;
                }
            }
        } catch (error) {
            // Ignore errors in case dataform global is not available
        }

        // Fallback to model schema to ensure assertions never fail due to missing dataset
        return modelSchema;
    }
}

module.exports = { WorkflowConfig };