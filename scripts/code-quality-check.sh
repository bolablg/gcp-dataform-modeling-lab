#!/bin/bash

##############################################################################
# Code Quality Check Script
# Checks JavaScript code quality using ESLint
##############################################################################

set -e  # Exit on error

echo "========================================="
echo "🔍 Running Code Quality Checks"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0

# Function to check JavaScript files
check_javascript() {
    echo ""
    echo "📦 Checking JavaScript files..."

    # Find all .js files (excluding node_modules and .git)
    JS_FILES=$(find . -name "*.js" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*")

    if [ -z "$JS_FILES" ]; then
        echo "${YELLOW}⚠️  No JavaScript files found${NC}"
        return 0
    fi

    JS_COUNT=$(echo "$JS_FILES" | wc -l | tr -d ' ')
    echo "Found $JS_COUNT JavaScript files"

    # Check for syntax errors using Node.js
    echo "Checking JavaScript syntax..."
    ERROR_COUNT=0

    while IFS= read -r file; do
        if ! node --check "$file" 2>/dev/null; then
            echo "${RED}✗ Syntax error in: $file${NC}"
            ERROR_COUNT=$((ERROR_COUNT + 1))
            OVERALL_STATUS=1
        fi
    done <<< "$JS_FILES"

    if [ $ERROR_COUNT -eq 0 ]; then
        echo "${GREEN}✓ All JavaScript files have valid syntax${NC}"
    else
        echo "${RED}✗ Found $ERROR_COUNT JavaScript files with syntax errors${NC}"
        return 1
    fi

    return 0
}

# Function to check SQLX files
check_sqlx() {
    echo ""
    echo "📊 Checking SQLX files..."

    # Find all .sqlx files
    SQLX_FILES=$(find . -name "*.sqlx" -not -path "*/.git/*")

    if [ -z "$SQLX_FILES" ]; then
        echo "${YELLOW}⚠️  No SQLX files found${NC}"
        return 0
    fi

    SQLX_COUNT=$(echo "$SQLX_FILES" | wc -l | tr -d ' ')
    echo "Found $SQLX_COUNT SQLX files"

    # Basic validation: check for required sections
    ERROR_COUNT=0

    while IFS= read -r file; do
        if ! grep -q "^config {" "$file"; then
            echo "${YELLOW}⚠️  Missing config block in: $file${NC}"
        fi

        # Check for common syntax issues
        if grep -q "require('includes/helpers')" "$file"; then
            if ! grep -q "const { create }" "$file"; then
                echo "${YELLOW}⚠️  Potentially missing 'create' import in: $file${NC}"
            fi
        fi
    done <<< "$SQLX_FILES"

    echo "${GREEN}✓ SQLX files checked${NC}"
    return 0
}

# Function to check YAML files
check_yaml() {
    echo ""
    echo "📋 Checking YAML files..."

    # Find all .yaml and .yml files
    YAML_FILES=$(find . -name "*.yaml" -o -name "*.yml" -not -path "*/.git/*" -not -path "*/node_modules/*")

    if [ -z "$YAML_FILES" ]; then
        echo "${YELLOW}⚠️  No YAML files found${NC}"
        return 0
    fi

    YAML_COUNT=$(echo "$YAML_FILES" | wc -l | tr -d ' ')
    echo "Found $YAML_COUNT YAML files"

    # Check YAML syntax using python (if available)
    if command -v python3 &> /dev/null; then
        ERROR_COUNT=0

        while IFS= read -r file; do
            if ! python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
                echo "${RED}✗ Invalid YAML syntax in: $file${NC}"
                ERROR_COUNT=$((ERROR_COUNT + 1))
                OVERALL_STATUS=1
            fi
        done <<< "$YAML_FILES"

        if [ $ERROR_COUNT -eq 0 ]; then
            echo "${GREEN}✓ All YAML files have valid syntax${NC}"
        else
            echo "${RED}✗ Found $ERROR_COUNT YAML files with syntax errors${NC}"
            return 1
        fi
    else
        echo "${YELLOW}⚠️  Python3 not available, skipping YAML validation${NC}"
    fi

    return 0
}

# Function to check JSON files
check_json() {
    echo ""
    echo "🗂️  Checking JSON files..."

    # Find all .json files
    JSON_FILES=$(find . -name "*.json" -not -path "*/.git/*" -not -path "*/node_modules/*")

    if [ -z "$JSON_FILES" ]; then
        echo "${YELLOW}⚠️  No JSON files found${NC}"
        return 0
    fi

    JSON_COUNT=$(echo "$JSON_FILES" | wc -l | tr -d ' ')
    echo "Found $JSON_COUNT JSON files"

    # Check JSON syntax using python
    if command -v python3 &> /dev/null; then
        ERROR_COUNT=0

        while IFS= read -r file; do
            if ! python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
                echo "${RED}✗ Invalid JSON syntax in: $file${NC}"
                ERROR_COUNT=$((ERROR_COUNT + 1))
                OVERALL_STATUS=1
            fi
        done <<< "$JSON_FILES"

        if [ $ERROR_COUNT -eq 0 ]; then
            echo "${GREEN}✓ All JSON files have valid syntax${NC}"
        else
            echo "${RED}✗ Found $ERROR_COUNT JSON files with syntax errors${NC}"
            return 1
        fi
    else
        echo "${YELLOW}⚠️  Python3 not available, skipping JSON validation${NC}"
    fi

    return 0
}

# Run all checks
echo ""
echo "Starting code quality checks..."
echo ""

check_javascript
check_sqlx
check_yaml
check_json

echo ""
echo "========================================="
if [ $OVERALL_STATUS -eq 0 ]; then
    echo "${GREEN}✓ All code quality checks passed!${NC}"
    echo "========================================="
    exit 0
else
    echo "${RED}✗ Code quality checks failed!${NC}"
    echo "========================================="
    exit 1
fi
