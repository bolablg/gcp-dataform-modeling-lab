#!/bin/bash

##############################################################################
# Google Chat Notification Script
# Sends structured error messages to Google Chat webhook with AI summaries
##############################################################################

set -e

# Function to get AI summary using Gemini
get_ai_summary() {
    local MESSAGE="$1"
    local ACTION="$2"
    local STAGE="$3"

    # Check if GEMINI_API_KEY is set
    if [ -z "$GEMINI_API_KEY" ]; then
        echo "$MESSAGE"  # Return original message if no API key
        return 0
    fi

    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        echo "$MESSAGE"  # Return original message if Python not available
        return 0
    fi

    # Get script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

    # Call Gemini summarizer
    local AI_SUMMARY=$(echo "$MESSAGE" | python3 "$SCRIPT_DIR/gemini_summarizer.py" \
        "$ACTION" \
        --stage "$STAGE" 2>/dev/null || echo "")

    if [ -n "$AI_SUMMARY" ]; then
        echo "$AI_SUMMARY"
    else
        echo "$MESSAGE"  # Fallback to original message
    fi
}

# Function to send notification to Google Chat
send_google_chat_notification() {
    local WEBHOOK_URL="$1"
    local STATUS="$2"
    local STAGE="$3"
    local ERROR_MESSAGE="$4"
    local BRANCH="$5"
    local COMMIT_SHA="$6"
    local COMMIT_MESSAGE="$7"
    local AUTHOR="$8"
    local RUN_URL="$9"

    # Determine card color based on status
    if [ "$STATUS" == "success" ]; then
        COLOR="#00FF00"
        EMOJI="✅"
        TITLE="Pipeline Success"
        # Get AI summary for success
        AI_SUMMARY=$(get_ai_summary "$COMMIT_MESSAGE" "summarize-success" "$STAGE")
        MESSAGE_TO_SEND="$AI_SUMMARY"
        DETAIL_HEADER="Deployment Details"
    elif [ "$STATUS" == "failure" ]; then
        COLOR="#FF0000"
        EMOJI="❌"
        TITLE="Pipeline Failed"
        # Get AI summary for error
        AI_SUMMARY=$(get_ai_summary "$ERROR_MESSAGE" "enhance-notification" "$STAGE")
        MESSAGE_TO_SEND="$AI_SUMMARY"
        DETAIL_HEADER="Error Analysis"
    else
        COLOR="#FFA500"
        EMOJI="⚠️"
        TITLE="Pipeline Warning"
        MESSAGE_TO_SEND="$ERROR_MESSAGE"
        DETAIL_HEADER="Warning Details"
    fi

    # Escape special characters in JSON
    MESSAGE_ESCAPED=$(echo "$MESSAGE_TO_SEND" | jq -Rs .)
    COMMIT_MESSAGE_ESCAPED=$(echo "$COMMIT_MESSAGE" | jq -Rs .)

    # Create JSON payload with card format
    PAYLOAD=$(cat <<EOF
{
  "cardsV2": [
    {
      "cardId": "pipeline-notification",
      "card": {
        "header": {
          "title": "$EMOJI $TITLE",
          "subtitle": "Branch: $BRANCH",
          "imageUrl": "https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png"
        },
        "sections": [
          {
            "header": "Pipeline Details",
            "widgets": [
              {
                "decoratedText": {
                  "topLabel": "Stage",
                  "text": "$STAGE",
                  "startIcon": {
                    "knownIcon": "STAR"
                  }
                }
              },
              {
                "decoratedText": {
                  "topLabel": "Status",
                  "text": "$STATUS",
                  "startIcon": {
                    "knownIcon": "BOOKMARK"
                  }
                }
              },
              {
                "decoratedText": {
                  "topLabel": "Branch",
                  "text": "$BRANCH",
                  "startIcon": {
                    "knownIcon": "CODE"
                  }
                }
              },
              {
                "decoratedText": {
                  "topLabel": "Commit",
                  "text": "${COMMIT_SHA:0:8}",
                  "startIcon": {
                    "knownIcon": "DESCRIPTION"
                  }
                }
              },
              {
                "decoratedText": {
                  "topLabel": "Author",
                  "text": "$AUTHOR",
                  "startIcon": {
                    "knownIcon": "PERSON"
                  }
                }
              }
            ]
          },
          {
            "header": "Commit Message",
            "widgets": [
              {
                "textParagraph": {
                  "text": $COMMIT_MESSAGE_ESCAPED
                }
              }
            ]
          },
          {
            "header": "$DETAIL_HEADER",
            "widgets": [
              {
                "textParagraph": {
                  "text": $MESSAGE_ESCAPED
                }
              }
            ]
          },
          {
            "widgets": [
              {
                "buttonList": {
                  "buttons": [
                    {
                      "text": "View Workflow Run",
                      "onClick": {
                        "openLink": {
                          "url": "$RUN_URL"
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
EOF
)

    # Send notification to Google Chat
    HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "$WEBHOOK_URL")

    HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n1)

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "✅ Google Chat notification sent successfully"
        return 0
    else
        echo "❌ Failed to send Google Chat notification. HTTP code: $HTTP_CODE"
        echo "Response: $HTTP_RESPONSE"
        return 1
    fi
}

# Main execution
main() {
    # Check required environment variables
    if [ -z "$GOOGLE_CHAT_WEBHOOK_URL" ]; then
        echo "Error: GOOGLE_CHAT_WEBHOOK_URL environment variable is not set"
        exit 1
    fi

    # Get parameters
    STATUS="${1:-failure}"
    STAGE="${2:-Unknown Stage}"
    ERROR_MESSAGE="${3:-No error message provided}"
    BRANCH="${4:-unknown}"
    COMMIT_SHA="${5:-unknown}"
    COMMIT_MESSAGE="${6:-No commit message}"
    AUTHOR="${7:-Unknown}"
    RUN_URL="${8:-https://github.com}"

    echo "========================================="
    echo "📢 Sending Google Chat Notification"
    echo "========================================="
    echo "Status: $STATUS"
    echo "Stage: $STAGE"
    echo "Branch: $BRANCH"
    echo "========================================="

    send_google_chat_notification \
        "$GOOGLE_CHAT_WEBHOOK_URL" \
        "$STATUS" \
        "$STAGE" \
        "$ERROR_MESSAGE" \
        "$BRANCH" \
        "$COMMIT_SHA" \
        "$COMMIT_MESSAGE" \
        "$AUTHOR" \
        "$RUN_URL"
}

# Run main function
main "$@"
