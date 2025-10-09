#!/usr/bin/env python3

"""
Gemini AI Summarization Script
Uses Google Gemini API to summarize logs, errors, and git diffs with context guardrails
"""

import os
import sys
import json
import argparse
from typing import Optional, Dict, Any
import requests

# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


class ContextGuardrails:
    """Define context guardrails for different summarization types"""

    # Maximum input lengths (characters)
    MAX_ERROR_LOG_LENGTH = 50000
    MAX_GIT_DIFF_LENGTH = 100000
    MAX_SUCCESS_LOG_LENGTH = 20000

    # Response constraints
    MAX_SUMMARY_TOKENS = 2048
    TEMPERATURE = 0.3  # Low temperature for consistent, factual responses

    # Safety settings
    SAFETY_SETTINGS = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]

    # System instructions for different contexts
    ERROR_LOG_SYSTEM_INSTRUCTION = """You are a senior DevOps engineer specializing in data pipeline debugging.
Your role is to analyze CI/CD pipeline errors and provide clear, actionable insights.

CONSTRAINTS:
- Be concise and technical
- Focus on root causes, not symptoms
- Provide specific, actionable solutions
- Use markdown formatting
- Keep total response under 500 words
- No generic advice - only specific to the error shown

PROHIBITED:
- Do not suggest unrelated solutions
- Do not provide code unless specifically relevant
- Do not be verbose or repetitive"""

    GIT_DIFF_SYSTEM_INSTRUCTION = """You are a technical lead reviewing code changes for data pipeline projects.
Your role is to generate clear, informative commit messages from git diffs.

CONSTRAINTS:
- Follow conventional commit format (feat/fix/refactor/docs/test/chore)
- Title line must be max 72 characters
- Focus on WHAT changed and WHY it matters
- Keep total response under 300 words
- Be specific about data pipeline impacts

PROHIBITED:
- Do not include generic phrases like "merge staging to main"
- Do not describe obvious changes (e.g., "added a file")
- Do not be overly verbose
- Do not include code snippets"""

    SUCCESS_SYSTEM_INSTRUCTION = """You are a DevOps communication specialist.
Your role is to create brief, celebratory summaries of successful deployments.

CONSTRAINTS:
- Be positive but professional
- Highlight key accomplishments
- Mention impact or next steps
- Keep total response under 150 words
- Use clear, non-technical language for notifications

PROHIBITED:
- Do not be overly casual or use emojis
- Do not include technical jargon
- Do not be verbose"""


class GeminiSummarizer:
    """Main class for Gemini API interactions"""

    def __init__(self, api_key: str):
        """Initialize with API key"""
        self.api_key = api_key
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    def _truncate_input(self, text: str, max_length: int) -> str:
        """Truncate input text to maximum length with warning"""
        if len(text) > max_length:
            print(f"{Colors.YELLOW}⚠ Input truncated from {len(text)} to {max_length} characters{Colors.NC}",
                  file=sys.stderr)
            return text[:max_length] + "\n\n... [truncated]"
        return text

    def _call_api(self, prompt: str, system_instruction: str) -> Optional[str]:
        """Call Gemini API with guardrails"""
        try:
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "systemInstruction": {
                    "parts": [{"text": system_instruction}]
                },
                "generationConfig": {
                    "temperature": ContextGuardrails.TEMPERATURE,
                    "topK": 40,
                    "topP": 0.95,
                    "maxOutputTokens": ContextGuardrails.MAX_SUMMARY_TOKENS
                },
                "safetySettings": ContextGuardrails.SAFETY_SETTINGS
            }

            response = requests.post(
                f"{self.api_url}?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            data = response.json()

            # Check for API errors
            if "error" in data:
                print(f"{Colors.RED}Gemini API Error: {data['error'].get('message', 'Unknown error')}{Colors.NC}",
                      file=sys.stderr)
                return None

            # Extract generated text
            if "candidates" in data and len(data["candidates"]) > 0:
                content = data["candidates"][0].get("content", {})
                parts = content.get("parts", [])
                if parts and "text" in parts[0]:
                    return parts[0]["text"].strip()

            print(f"{Colors.RED}Error: No valid response from Gemini API{Colors.NC}", file=sys.stderr)
            return None

        except requests.exceptions.Timeout:
            print(f"{Colors.RED}Error: Gemini API request timed out{Colors.NC}", file=sys.stderr)
            return None
        except requests.exceptions.RequestException as e:
            print(f"{Colors.RED}Error calling Gemini API: {str(e)}{Colors.NC}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"{Colors.RED}Unexpected error: {str(e)}{Colors.NC}", file=sys.stderr)
            return None

    def summarize_error_logs(self, error_message: str, stage: str) -> str:
        """Summarize error logs with context guardrails"""
        print(f"{Colors.BLUE}🤖 Generating AI summary of error logs for stage: {stage}...{Colors.NC}",
              file=sys.stderr)

        # Truncate if needed
        error_message = self._truncate_input(error_message, ContextGuardrails.MAX_ERROR_LOG_LENGTH)

        prompt = f"""Analyze this CI/CD pipeline error from the {stage} stage:

ERROR DETAILS:
```
{error_message}
```

Provide a structured analysis:

## 🔍 Root Cause
[1-2 sentences explaining what caused this error]

## 💥 Impact
[1 sentence on what failed and why it matters]

## 🔧 Solution
[2-4 specific, actionable steps to fix this]

## 📌 Prevention
[1 brief tip to prevent this in the future]

Keep it concise, technical, and actionable."""

        summary = self._call_api(prompt, ContextGuardrails.ERROR_LOG_SYSTEM_INSTRUCTION)

        if summary:
            print(f"{Colors.GREEN}✓ AI summary generated{Colors.NC}", file=sys.stderr)
            return summary
        else:
            print(f"{Colors.YELLOW}⚠ Failed to generate AI summary, using original error{Colors.NC}",
                  file=sys.stderr)
            return f"**Error in {stage}:**\n\n```\n{error_message[:1000]}\n```"

    def summarize_git_diff(self, git_diff: str) -> str:
        """Summarize git diff for merge commit message"""
        print(f"{Colors.BLUE}🤖 Generating AI summary of code changes...{Colors.NC}", file=sys.stderr)

        # Truncate if needed
        git_diff = self._truncate_input(git_diff, ContextGuardrails.MAX_GIT_DIFF_LENGTH)

        # Extract basic stats
        files_changed = git_diff.count("diff --git")
        insertions = git_diff.count("\n+") - git_diff.count("\n+++")
        deletions = git_diff.count("\n-") - git_diff.count("\n---")

        prompt = f"""Analyze this git diff for a Dataform data pipeline project:

STATISTICS:
- Files Changed: {files_changed}
- Lines Added: {insertions}
- Lines Removed: {deletions}

GIT DIFF:
```diff
{git_diff}
```

Generate a commit message in this exact format:

**[type]: [concise title max 72 chars]**

**Summary:**
[2-3 sentences explaining the changes and their purpose]

**Key Changes:**
- [Specific change 1]
- [Specific change 2]
- [Specific change 3]
[add more if needed, max 5]

**Impact:**
[1 sentence on how this affects the data pipeline]

Use conventional commit types: feat, fix, refactor, docs, test, chore, perf."""

        summary = self._call_api(prompt, ContextGuardrails.GIT_DIFF_SYSTEM_INSTRUCTION)

        if summary:
            print(f"{Colors.GREEN}✓ AI merge message generated{Colors.NC}", file=sys.stderr)
            return summary
        else:
            print(f"{Colors.YELLOW}⚠ Failed to generate AI summary, using default{Colors.NC}",
                  file=sys.stderr)
            return f"""chore: merge staging to main

Summary:
Merged {files_changed} file(s) with {insertions} additions and {deletions} deletions.

Key Changes:
- {files_changed} files modified
- Code quality and pipeline updates

Impact:
Pipeline improvements and bug fixes."""

    def summarize_success(self, commit_message: str, files_changed: int = 0) -> str:
        """Summarize successful pipeline run"""
        print(f"{Colors.BLUE}🤖 Generating success summary...{Colors.NC}", file=sys.stderr)

        # Truncate if needed
        commit_message = self._truncate_input(commit_message, ContextGuardrails.MAX_SUCCESS_LOG_LENGTH)

        prompt = f"""Summarize this successful CI/CD pipeline deployment:

COMMIT MESSAGE:
```
{commit_message}
```

FILES CHANGED: {files_changed}

Create a brief, professional summary (2-3 sentences) that:
1. Highlights what was deployed/merged
2. Mentions key accomplishments
3. Notes the impact or next steps

Be positive, clear, and concise."""

        summary = self._call_api(prompt, ContextGuardrails.SUCCESS_SYSTEM_INSTRUCTION)

        if summary:
            print(f"{Colors.GREEN}✓ Success summary generated{Colors.NC}", file=sys.stderr)
            return summary
        else:
            return "✅ Pipeline completed successfully. All quality checks passed and changes have been merged to main."

    def create_enhanced_notification(self, original_message: str, stage: str) -> str:
        """Create enhanced notification with AI summary at the top"""
        ai_summary = self.summarize_error_logs(original_message, stage)

        return f"""## 🤖 AI Analysis

{ai_summary}

---

## 📋 Full Error Log

<details>
<summary>Click to expand complete error details</summary>

```
{original_message}
```

</details>"""


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Gemini AI Summarizer for CI/CD Pipeline Logs",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "action",
        choices=["summarize-error", "summarize-diff", "summarize-success", "enhance-notification"],
        help="Type of summarization to perform"
    )

    parser.add_argument(
        "--input-file",
        type=str,
        help="Input file path (default: stdin)"
    )

    parser.add_argument(
        "--stage",
        type=str,
        default="Unknown Stage",
        help="Pipeline stage name (for error summarization)"
    )

    parser.add_argument(
        "--files-changed",
        type=int,
        default=0,
        help="Number of files changed (for success summarization)"
    )

    parser.add_argument(
        "--output-file",
        type=str,
        help="Output file path (default: stdout)"
    )

    args = parser.parse_args()

    # Get API key from environment
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(f"{Colors.RED}Error: GEMINI_API_KEY environment variable is not set{Colors.NC}",
              file=sys.stderr)
        sys.exit(1)

    # Read input
    if args.input_file:
        try:
            with open(args.input_file, 'r', encoding='utf-8') as f:
                input_content = f.read()
        except Exception as e:
            print(f"{Colors.RED}Error reading input file: {str(e)}{Colors.NC}", file=sys.stderr)
            sys.exit(1)
    else:
        input_content = sys.stdin.read()

    if not input_content.strip():
        print(f"{Colors.RED}Error: No input provided{Colors.NC}", file=sys.stderr)
        sys.exit(1)

    # Create summarizer
    summarizer = GeminiSummarizer(api_key)

    # Perform action
    try:
        if args.action == "summarize-error":
            result = summarizer.summarize_error_logs(input_content, args.stage)
        elif args.action == "summarize-diff":
            result = summarizer.summarize_git_diff(input_content)
        elif args.action == "summarize-success":
            result = summarizer.summarize_success(input_content, args.files_changed)
        elif args.action == "enhance-notification":
            result = summarizer.create_enhanced_notification(input_content, args.stage)
        else:
            print(f"{Colors.RED}Error: Unknown action{Colors.NC}", file=sys.stderr)
            sys.exit(1)

        # Write output
        if args.output_file:
            with open(args.output_file, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"{Colors.GREEN}✓ Summary written to {args.output_file}{Colors.NC}", file=sys.stderr)
        else:
            print(result)

    except Exception as e:
        print(f"{Colors.RED}Error during summarization: {str(e)}{Colors.NC}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
