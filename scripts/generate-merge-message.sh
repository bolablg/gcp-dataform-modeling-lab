#!/bin/bash

##############################################################################
# AI-Powered Merge Message Generator
# Generates intelligent merge commit messages using Gemini AI
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${BLUE}=========================================${NC}"
echo "${BLUE}🤖 Generating AI-Powered Merge Message${NC}"
echo "${BLUE}=========================================${NC}"

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "${YELLOW}⚠ GEMINI_API_KEY not set, using default merge message${NC}" >&2

    # Generate default message
    cat <<EOF
chore: merge staging to main after successful CI/CD pipeline

Pipeline run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}
Commit: ${GITHUB_SHA}
Author: ${GITHUB_ACTOR}
EOF
    exit 0
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "${YELLOW}⚠ Python3 not available, using default merge message${NC}" >&2

    # Generate default message
    cat <<EOF
chore: merge staging to main after successful CI/CD pipeline

Pipeline run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}
Commit: ${GITHUB_SHA}
Author: ${GITHUB_ACTOR}
EOF
    exit 0
fi

# Get the diff between main and staging
echo "${BLUE}📊 Fetching git diff between main and staging...${NC}" >&2

GIT_DIFF=$(git diff origin/main...origin/staging 2>&1 || echo "")

if [ -z "$GIT_DIFF" ]; then
    echo "${YELLOW}⚠ No diff found between branches${NC}" >&2

    # Generate default message
    cat <<EOF
chore: merge staging to main (no changes detected)

Pipeline run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}
EOF
    exit 0
fi

# Show diff stats
FILES_CHANGED=$(echo "$GIT_DIFF" | grep -c "^diff --git" || echo "0")
echo "${BLUE}📁 Files changed: $FILES_CHANGED${NC}" >&2

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Generate AI summary using Gemini
echo "${BLUE}🤖 Calling Gemini AI to generate merge message...${NC}" >&2

AI_MESSAGE=$(echo "$GIT_DIFF" | python3 "$SCRIPT_DIR/gemini_summarizer.py" \
    "summarize-diff" 2>&1)

if [ $? -eq 0 ] && [ -n "$AI_MESSAGE" ]; then
    echo "${GREEN}✅ AI merge message generated successfully${NC}" >&2

    # Output the AI-generated message with additional context
    echo "$AI_MESSAGE"
    echo ""
    echo "---"
    echo ""
    echo "🤖 Generated with AI assistance"
    echo "Pipeline: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
    echo "Commit: ${GITHUB_SHA}"
    echo "Author: ${GITHUB_ACTOR}"
else
    echo "${YELLOW}⚠ Failed to generate AI message, using default${NC}" >&2

    # Generate default message with stats
    cat <<EOF
chore: merge staging to main

Summary:
Merged $FILES_CHANGED file(s) from staging to main after successful CI/CD validation.

Pipeline run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}
Commit: ${GITHUB_SHA}
Author: ${GITHUB_ACTOR}
EOF
fi
