#!/bin/bash

##############################################################################
# Dataform Dry Run Script
# Executes Dataform dry run and checks for errors
##############################################################################

set -e

echo "========================================="
echo "🧪 Running Dataform Dry Run"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if dataform is installed
if ! command -v dataform &> /dev/null; then
    echo "${YELLOW}Installing Dataform CLI...${NC}"
    npm install -g @dataform/cli
fi

# Read project configuration from workflow_settings.yaml
if [ ! -f "workflow_settings.yaml" ]; then
    echo "${RED}Error: workflow_settings.yaml not found${NC}"
    exit 1
fi

# Extract configuration (requires yq or python with yaml)
if command -v yq &> /dev/null; then
    PROJECT_ID=$(yq eval '.defaultProject' workflow_settings.yaml)
    LOCATION=$(yq eval '.defaultLocation' workflow_settings.yaml)
else
    # Fallback to Python
    PROJECT_ID=$(python3 -c "import yaml; print(yaml.safe_load(open('workflow_settings.yaml'))['defaultProject'])")
    LOCATION=$(python3 -c "import yaml; print(yaml.safe_load(open('workflow_settings.yaml'))['defaultLocation'])")
fi

echo "Project ID: $PROJECT_ID"
echo "Location: $LOCATION"
echo ""

# Function to run dry run
run_dry_run() {
    echo "🔄 Executing dry run..."

    # Create output file for results
    DRY_RUN_OUTPUT=$(mktemp)

    # Run dataform dry run (with --full-refresh flag if needed)
    if dataform run --dry-run --json > "$DRY_RUN_OUTPUT" 2>&1; then
        echo "${GREEN}✓ Dry run completed successfully${NC}"

        # Parse and display results
        if command -v jq &> /dev/null; then
            echo ""
            echo "📊 Dry Run Summary:"
            jq -r '.actions[] | "  - \(.target.name) (\(.type))"' "$DRY_RUN_OUTPUT" || true
        fi

        rm -f "$DRY_RUN_OUTPUT"
        return 0
    else
        echo "${RED}✗ Dry run failed${NC}"
        echo ""
        echo "Error details:"
        cat "$DRY_RUN_OUTPUT"

        # Save error for notification
        ERROR_MESSAGE=$(cat "$DRY_RUN_OUTPUT")
        rm -f "$DRY_RUN_OUTPUT"

        # Export error for GitHub Actions
        if [ -n "$GITHUB_ENV" ]; then
            echo "DRY_RUN_ERROR<<EOF" >> "$GITHUB_ENV"
            echo "$ERROR_MESSAGE" >> "$GITHUB_ENV"
            echo "EOF" >> "$GITHUB_ENV"
        fi

        return 1
    fi
}

# Function to check assertions
check_assertions() {
    echo ""
    echo "🧪 Checking assertions..."

    # Find all assertion files
    ASSERTION_FILES=$(find definitions -name "*_assertion_*" -type f 2>/dev/null || echo "")

    if [ -z "$ASSERTION_FILES" ]; then
        echo "${YELLOW}⚠️  No assertion files found${NC}"
        return 0
    fi

    ASSERTION_COUNT=$(echo "$ASSERTION_FILES" | wc -l | tr -d ' ')
    echo "Found $ASSERTION_COUNT assertion files"

    # Dry run assertions
    ASSERTION_OUTPUT=$(mktemp)

    if dataform run --dry-run --tags assertion --json > "$ASSERTION_OUTPUT" 2>&1; then
        echo "${GREEN}✓ All assertions validated${NC}"
        rm -f "$ASSERTION_OUTPUT"
        return 0
    else
        echo "${RED}✗ Assertion validation failed${NC}"
        cat "$ASSERTION_OUTPUT"

        # Save error for notification
        ASSERTION_ERROR=$(cat "$ASSERTION_OUTPUT")
        rm -f "$ASSERTION_OUTPUT"

        # Export error for GitHub Actions
        if [ -n "$GITHUB_ENV" ]; then
            echo "ASSERTION_ERROR<<EOF" >> "$GITHUB_ENV"
            echo "$ASSERTION_ERROR" >> "$GITHUB_ENV"
            echo "EOF" >> "$GITHUB_ENV"
        fi

        return 1
    fi
}

# Main execution
main() {
    echo "Starting Dataform dry run validation..."
    echo ""

    # Track overall status
    OVERALL_STATUS=0

    # Run dry run
    if ! run_dry_run; then
        OVERALL_STATUS=1
        echo ""
        echo "${RED}Dry run failed - stopping here${NC}"
        exit 1
    fi

    # Check assertions
    if ! check_assertions; then
        OVERALL_STATUS=1
    fi

    echo ""
    echo "========================================="
    if [ $OVERALL_STATUS -eq 0 ]; then
        echo "${GREEN}✓ All Dataform validations passed!${NC}"
        echo "========================================="
        exit 0
    else
        echo "${RED}✗ Dataform validation failed!${NC}"
        echo "========================================="
        exit 1
    fi
}

# Run main function
main
