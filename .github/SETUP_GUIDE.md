# CI/CD Pipeline Setup Guide

## Quick Start

This guide will help you set up the automated CI/CD pipeline for your Dataform project in under 10 minutes.

## Prerequisites

- GitHub repository with Admin access
- Google Cloud Platform project
- BigQuery enabled in GCP
- Google Chat space for notifications

## Step-by-Step Setup

### Step 1: Configure GitHub Secrets

Navigate to your GitHub repository:
1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**

#### Create `GOOGLE_CHAT_WEBHOOK_URL`

**How to get the webhook URL:**
1. Open Google Chat
2. Go to the space where you want notifications
3. Click the space name → **Apps & integrations**
4. Click **Add webhooks**
5. Name it "Dataform Pipeline Notifications"
6. Click **Save**
7. Copy the webhook URL
8. Paste it as the secret value in GitHub

#### Create `GCP_SA_KEY`

**How to create the service account:**
1. Go to [GCP Console](https://console.cloud.google.com)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Click **Create Service Account**
4. Name: `dataform-ci-cd`
5. Description: `Service account for Dataform CI/CD pipeline`
6. Click **Create and Continue**

**Grant permissions:**
- BigQuery Data Editor
- BigQuery Job User
- BigQuery Read Session User

**Create key:**
1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON**
5. Download the JSON file
6. Open it and copy the entire content
7. Paste it as the secret value in GitHub

#### Create `GEMINI_API_KEY` 🤖

**How to get the Gemini API key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Create API Key**
3. Select your Google Cloud project (or create a new one)
4. Click **Create API key in existing project**
5. Copy the generated API key
6. Paste it as the secret value in GitHub

**Why Gemini AI?**
- 🤖 **AI-Powered Error Analysis** - Intelligent summaries of pipeline errors
- 📝 **Smart Merge Messages** - Auto-generated commit messages from git diffs
- 💡 **Actionable Insights** - Root cause analysis and solutions
- 🎯 **Context-Aware** - Understands Dataform and BigQuery contexts

**Note:** Gemini API has a generous free tier. See [pricing](https://ai.google.dev/pricing) for details.

### Step 2: Verify Branch Structure

Ensure you have these branches:
```bash
git branch
```

You should see:
- `main` (or `master`)
- `staging`

If you don't have a `staging` branch:
```bash
git checkout -b staging
git push -u origin staging
```

### Step 3: Test the Pipeline

1. Make a small change in the `staging` branch:
   ```bash
   git checkout staging
   echo "# Test" >> test.md
   git add test.md
   git commit -m "test: trigger CI/CD pipeline"
   git push origin staging
   ```

2. Go to **Actions** tab in GitHub
3. You should see the workflow running
4. Check Google Chat for notifications

### Step 4: Monitor First Run

The pipeline will execute these stages:
1. ✅ Code Quality Check (~30 seconds)
2. ✅ Compile Dataform (~1 minute)
3. ✅ Dry Run (~2 minutes)
4. ✅ Check Assertions (~1 minute)
5. ✅ Merge to Main (~10 seconds)

**Total time:** ~5 minutes

## Troubleshooting

### Google Chat Notification Not Received

**Issue:** Webhook URL is incorrect or secret not set

**Solution:**
1. Verify the webhook URL is correct
2. Test the webhook:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"text": "Test notification"}' \
     YOUR_WEBHOOK_URL
   ```
3. Check the secret is properly set in GitHub

### GCP Authentication Failed

**Issue:** Service account key is incorrect or missing permissions

**Solution:**
1. Verify the service account has BigQuery permissions
2. Ensure the JSON key is valid:
   ```bash
   cat service-account-key.json | jq .
   ```
3. Check the secret contains the full JSON (including `{` and `}`)

### Code Quality Check Failed

**Issue:** Syntax errors in code

**Solution:**
1. Run locally:
   ```bash
   ./scripts/code-quality-check.sh
   ```
2. Fix any syntax errors
3. Commit and push again

### Compilation Failed

**Issue:** Dataform configuration errors

**Solution:**
1. Run locally:
   ```bash
   dataform compile
   ```
2. Review error messages
3. Fix configuration issues
4. Commit and push

### Dry Run Failed

**Issue:** SQL syntax errors or BigQuery permission issues

**Solution:**
1. Check BigQuery permissions
2. Run locally:
   ```bash
   ./scripts/dataform-dry-run.sh
   ```
3. Fix SQL errors
4. Verify `workflow_settings.yaml` is correct

### Merge Failed

**Issue:** Merge conflicts between staging and main

**Solution:**
1. Update staging with main:
   ```bash
   git checkout staging
   git pull origin main
   ```
2. Resolve conflicts
3. Commit and push

## Best Practices

### 1. Development Workflow

```bash
# Always work on feature branches
git checkout -b feature/new-model
# Make changes
git add .
git commit -m "feat: add new model"

# Merge to staging first
git checkout staging
git merge feature/new-model
git push origin staging

# Pipeline auto-merges staging → main if all checks pass
```

### 2. Commit Message Format

Use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code refactoring
- `docs:` Documentation updates
- `test:` Test updates
- `chore:` Maintenance tasks

### 3. Monitor Pipeline Runs

- Check GitHub Actions tab regularly
- Review Google Chat notifications
- Download artifacts for failed runs

### 4. Regular Maintenance

- Update dependencies monthly
- Review and update assertions
- Monitor BigQuery costs
- Rotate service account keys quarterly

## Advanced Configuration

### Customize Workflow Triggers

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
  schedule:
    - cron: '0 0 * * *'  # Run daily at midnight
```

### Add Slack Notifications

1. Create `scripts/send-slack-notification.sh`
2. Add `SLACK_WEBHOOK_URL` secret
3. Modify workflow to call Slack script

### Add Email Notifications

Use GitHub Actions marketplace actions:
```yaml
- name: Send email
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{secrets.MAIL_USERNAME}}
    password: ${{secrets.MAIL_PASSWORD}}
    subject: Pipeline Failed
    body: Check the logs
```

### Custom Quality Checks

Add your own checks to `scripts/code-quality-check.sh`:

```bash
# Example: Check for TODO comments
check_todos() {
    TODO_COUNT=$(grep -r "TODO" --include="*.js" --include="*.sqlx" . | wc -l)
    if [ $TODO_COUNT -gt 10 ]; then
        echo "Warning: $TODO_COUNT TODO comments found"
    fi
}
```

## Cost Optimization

### BigQuery Costs

The pipeline uses:
- **Dry Run**: Free (validates queries without execution)
- **Compilation**: Free (local operation)
- **Assertions**: Minimal cost (only validates data)

**Estimated cost:** < $0.01 per pipeline run

### GitHub Actions Minutes

The pipeline takes ~5 minutes per run:
- Free tier: 2,000 minutes/month
- Can handle: ~400 pipeline runs/month
- More than enough for most teams

## Security Best Practices

1. **Never commit credentials**
   - Use GitHub Secrets
   - Add `.env` to `.gitignore`
   - Rotate keys regularly

2. **Principle of Least Privilege**
   - Service account has only BigQuery access
   - No broader GCP permissions

3. **Audit Trail**
   - All pipeline runs logged
   - Google Chat notifications
   - GitHub Actions history

4. **Branch Protection**
   - Protect `main` branch
   - Require status checks
   - Require pull request reviews

## Support and Resources

- **Pipeline Documentation**: [.github/workflows/README.md](workflows/README.md)
- **Main Documentation**: [docs/](../docs/)
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)

## Next Steps

1. ✅ Set up secrets
2. ✅ Test pipeline
3. ✅ Configure branch protection
4. ✅ Train team members
5. ✅ Document custom workflows
6. ✅ Set up monitoring dashboard

**Congratulations!** Your CI/CD pipeline is now ready for production use! 🎉
