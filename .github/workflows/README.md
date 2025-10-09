# Dataform CI/CD Pipeline Documentation

## Overview

This CI/CD pipeline automates the testing, validation, and deployment of Dataform projects. It runs on pushes to the `staging` branch and performs comprehensive quality checks before merging to `main`.

## Pipeline Stages

### 1. 🔍 Code Quality Checks
- **Purpose**: Validate syntax and code quality across all project files
- **Languages Checked**:
  - JavaScript (`.js`) - Node.js syntax validation
  - SQLX (`.sqlx`) - Config block and import validation
  - YAML (`.yaml`, `.yml`) - YAML syntax validation
  - JSON (`.json`) - JSON syntax validation
- **Script**: `scripts/code-quality-check.sh`

### 2. 🏗️ Compile Dataform Project
- **Purpose**: Compile the Dataform project to catch compilation errors
- **Tool**: Dataform CLI
- **Outputs**:
  - Compilation results (JSON format)
  - Summary of tables and views
- **Artifacts**: Compilation output saved for debugging

### 3. 🧪 Dataform Dry Run
- **Purpose**: Execute a dry run to validate SQL queries without running them
- **Requirements**:
  - GCP Service Account credentials
  - Access to BigQuery
- **Script**: `scripts/dataform-dry-run.sh`
- **Outputs**: Dry run results and query validation

### 4. ✅ Check Assertions
- **Purpose**: Validate all data quality and business rule assertions
- **Focus**: Run assertions with `--tags assertion` flag
- **Validates**:
  - Data quality checks (not_null, unique_key, accepted_values, relationships)
  - Business rules (freshness, row_count, percentage)

### 5. 🔀 Merge to Main
- **Purpose**: Automatically merge staging to main after all checks pass
- **Trigger**: Only runs if all previous stages succeed
- **Actions**:
  - Fetches latest changes from both branches
  - Performs non-fast-forward merge
  - Pushes merged changes to main
  - Sends success notification to Google Chat

## Required Secrets

Configure these secrets in your GitHub repository settings:

### `GOOGLE_CHAT_WEBHOOK_URL`
- **Description**: Webhook URL for Google Chat notifications
- **How to create**:
  1. Go to Google Chat
  2. Select a space
  3. Click Space settings → Manage webhooks
  4. Create a new webhook
  5. Copy the webhook URL

### `GCP_SA_KEY`
- **Description**: Google Cloud Platform Service Account key (JSON)
- **Permissions Required**:
  - `bigquery.datasets.get`
  - `bigquery.tables.create`
  - `bigquery.tables.get`
  - `bigquery.tables.list`
  - `bigquery.jobs.create`
- **How to create**:
  1. Go to GCP Console → IAM & Admin → Service Accounts
  2. Create a new service account (or use existing)
  3. Grant BigQuery permissions
  4. Create a JSON key
  5. Copy the entire JSON content to the secret

### `GITHUB_TOKEN`
- **Description**: GitHub Personal Access Token (automatically provided by GitHub Actions)
- **Permissions**: Automatically configured with repository write access

## Google Chat Notifications

The pipeline sends structured notifications to Google Chat for:

### Success Notifications ✅
- Sent when all stages pass and merge completes
- Includes pipeline summary and merge details

### Failure Notifications ❌
- Sent when any stage fails
- Includes:
  - Stage that failed
  - Error message details
  - Commit information
  - Link to workflow run

### Notification Card Format
```
┌─────────────────────────────────────┐
│ ✅/❌ Pipeline Status                │
│ Branch: staging                      │
├─────────────────────────────────────┤
│ Stage: [Stage Name]                  │
│ Status: [success/failure]            │
│ Branch: [branch name]                │
│ Commit: [short SHA]                  │
│ Author: [commit author]              │
├─────────────────────────────────────┤
│ Commit Message: [message]            │
├─────────────────────────────────────┤
│ Error Details: [if applicable]       │
├─────────────────────────────────────┤
│ [View Workflow Run] (button)         │
└─────────────────────────────────────┘
```

## Workflow Configuration

### Trigger Conditions
```yaml
on:
  push:
    branches:
      - staging
```

### Environment Variables
- `NODE_VERSION`: '18' (Node.js version)
- `PYTHON_VERSION`: '3.10' (Python version)

## Usage

### Manual Trigger
To trigger the pipeline manually:

1. Push changes to the `staging` branch:
   ```bash
   git checkout staging
   git add .
   git commit -m "Your commit message"
   git push origin staging
   ```

2. The pipeline will automatically start

### Monitor Progress
- Go to **Actions** tab in your GitHub repository
- Click on the latest workflow run
- View each stage's logs and outputs

### Download Artifacts
After pipeline completion, download artifacts for debugging:
- `compile-output`: Compilation results
- `dry-run-output`: Dry run results
- `assertions-output`: Assertion validation results

## Troubleshooting

### Common Issues

#### 1. Code Quality Check Fails
- **Cause**: Syntax errors in JavaScript, YAML, or JSON files
- **Solution**: Review the error message and fix syntax errors
- **Check**: Run `./scripts/code-quality-check.sh` locally

#### 2. Compilation Fails
- **Cause**: Invalid Dataform configuration or SQL syntax
- **Solution**: Review compilation output artifact
- **Check**: Run `dataform compile` locally

#### 3. Dry Run Fails
- **Cause**: Invalid SQL queries or missing dependencies
- **Solution**: Check BigQuery permissions and query syntax
- **Check**: Run `./scripts/dataform-dry-run.sh` locally

#### 4. Assertion Fails
- **Cause**: Data quality issues or incorrect assertion configuration
- **Solution**: Review assertion definitions and data
- **Check**: Run `dataform run --dry-run --tags assertion` locally

#### 5. Merge Fails
- **Cause**: Merge conflicts between staging and main
- **Solution**: Manually resolve conflicts
- **Steps**:
  ```bash
  git checkout main
  git pull origin main
  git merge origin/staging
  # Resolve conflicts
  git commit
  git push origin main
  ```

#### 6. Google Chat Notification Not Sent
- **Cause**: Invalid webhook URL or incorrect secret configuration
- **Solution**: Verify `GOOGLE_CHAT_WEBHOOK_URL` secret
- **Test**: Run notification script manually

## Local Testing

### Test Code Quality Checks
```bash
./scripts/code-quality-check.sh
```

### Test Dataform Compilation
```bash
dataform compile
```

### Test Dry Run
```bash
./scripts/dataform-dry-run.sh
```

### Test Google Chat Notification
```bash
export GOOGLE_CHAT_WEBHOOK_URL="your-webhook-url"
./scripts/send-google-chat-notification.sh \
  "success" \
  "Test Stage" \
  "This is a test message" \
  "staging" \
  "abc123" \
  "Test commit" \
  "Your Name" \
  "https://github.com"
```

## Customization

### Modify Workflow Triggers
Edit `.github/workflows/dataform-ci-cd.yml`:
```yaml
on:
  push:
    branches:
      - staging
      - develop  # Add more branches
  pull_request:
    branches:
      - staging
```

### Add Custom Checks
1. Create a new script in `scripts/` directory
2. Make it executable: `chmod +x scripts/your-script.sh`
3. Add a new job in the workflow YAML
4. Configure dependencies and error handling

### Customize Notifications
Edit `scripts/send-google-chat-notification.sh` to modify:
- Card layout
- Message format
- Additional metadata

## Best Practices

1. **Always test locally before pushing**
   - Run code quality checks
   - Compile Dataform project
   - Validate assertions

2. **Keep staging up-to-date**
   - Regularly sync with main branch
   - Resolve conflicts promptly

3. **Monitor pipeline runs**
   - Check Google Chat notifications
   - Review logs for warnings

4. **Use descriptive commit messages**
   - Helps identify issues in notifications
   - Improves audit trail

5. **Handle secrets securely**
   - Never commit credentials
   - Rotate secrets regularly
   - Use least privilege access

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review workflow logs in GitHub Actions
3. Check Google Chat notifications for error details
4. Review the [main documentation](../../docs/)

## Version History

- **v1.3.0** (2025-10-09): Initial CI/CD pipeline implementation
  - Code quality checks
  - Dataform compilation and dry run
  - Assertion validation
  - Auto-merge to main
  - Google Chat notifications
