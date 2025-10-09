# CI/CD Pipeline Quick Reference

## 🚀 Quick Commands

### Trigger Pipeline
```bash
git checkout staging
git add .
git commit -m "your message"
git push origin staging
```

### Test Locally
```bash
# Code quality
./scripts/code-quality-check.sh

# Dataform compilation
dataform compile

# Dry run (requires GCP auth)
./scripts/dataform-dry-run.sh

# Test notification
export GOOGLE_CHAT_WEBHOOK_URL="your-url"
./scripts/send-google-chat-notification.sh "success" "Test" "Test message" "staging" "abc123" "Test" "You" "https://github.com"
```

## 📊 Pipeline Stages

| Stage | Duration | Purpose |
|-------|----------|---------|
| 🔍 Code Quality | ~30s | Validate syntax (JS, SQLX, YAML, JSON) |
| 🏗️ Compile | ~1m | Compile Dataform project |
| 🧪 Dry Run | ~2m | Validate SQL queries |
| ✅ Assertions | ~1m | Check data quality |
| 🔀 Merge | ~10s | Auto-merge to main |

**Total:** ~5 minutes

## 🔐 Required Secrets

| Secret | How to Get |
|--------|-----------|
| `GOOGLE_CHAT_WEBHOOK_URL` | Google Chat → Space → Webhooks → Create |
| `GCP_SA_KEY` | GCP Console → IAM → Service Accounts → Create Key (JSON) |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions |

## 📢 Notification Types

### Success ✅
- All stages passed
- Staging merged to main
- Green card in Google Chat

### Failure ❌
- Any stage failed
- Pipeline stopped
- Red card with error details

## 🔧 Troubleshooting

### Pipeline Not Triggered
- Check you're pushing to `staging` branch
- Verify workflow file exists: `.github/workflows/dataform-ci-cd.yml`

### Code Quality Failed
```bash
./scripts/code-quality-check.sh
# Fix errors shown
git add .
git commit -m "fix: code quality issues"
git push origin staging
```

### Compilation Failed
```bash
dataform compile
# Review errors
# Fix configuration
git commit -am "fix: compilation errors"
git push origin staging
```

### Dry Run Failed
- Check GCP credentials
- Verify BigQuery permissions
- Review SQL syntax

### Merge Failed
```bash
git checkout staging
git pull origin main
# Resolve conflicts
git commit
git push origin staging
```

## 📁 File Structure

```
.github/
├── workflows/
│   ├── dataform-ci-cd.yml    # Main workflow
│   └── README.md             # Full documentation
├── SETUP_GUIDE.md            # Setup instructions
└── QUICK_REFERENCE.md        # This file

scripts/
├── code-quality-check.sh     # Syntax validation
├── dataform-dry-run.sh       # Query validation
└── send-google-chat-notification.sh  # Notifications
```

## 🎯 Common Tasks

### Skip CI/CD
Not recommended, but if needed:
```bash
git commit -m "docs: update README [skip ci]"
```

### Run Specific Stage Locally
```bash
# Code quality only
./scripts/code-quality-check.sh

# Compilation only
dataform compile

# Dry run only
./scripts/dataform-dry-run.sh
```

### View Logs
1. Go to GitHub → Actions tab
2. Click on the workflow run
3. Expand stage to view logs

### Download Artifacts
1. Go to GitHub → Actions → Workflow run
2. Scroll to "Artifacts" section
3. Download:
   - `compile-output` - Compilation results
   - `dry-run-output` - Dry run logs
   - `assertions-output` - Assertion results

## 🔄 Workflow Customization

### Add More Branches
Edit `.github/workflows/dataform-ci-cd.yml`:
```yaml
on:
  push:
    branches:
      - staging
      - develop  # Add this
```

### Change Node Version
```yaml
env:
  NODE_VERSION: '20'  # Update this
```

### Disable Auto-Merge
Comment out the `merge-to-main` job in the workflow file.

## 📚 Documentation Links

- [Full Setup Guide](.github/SETUP_GUIDE.md)
- [Pipeline Documentation](.github/workflows/README.md)
- [Changelog](../CHANGELOG.md)
- [Main Docs](../docs/)

## 🆘 Get Help

1. Check [Troubleshooting](.github/workflows/README.md#troubleshooting)
2. Review Google Chat notifications
3. Download workflow artifacts
4. Check GitHub Actions logs

## 💡 Best Practices

- ✅ Always test locally first
- ✅ Use conventional commit messages
- ✅ Monitor Google Chat notifications
- ✅ Review failed stage logs
- ✅ Keep staging in sync with main
- ✅ Rotate GCP keys quarterly

## ⚡ Performance Tips

- Code quality runs fastest (~30s)
- Dry run takes longest (~2m)
- Total pipeline: ~5 minutes
- Free for most teams (GitHub Actions free tier)

---

**Need more help?** See [SETUP_GUIDE.md](SETUP_GUIDE.md) or [workflows/README.md](workflows/README.md)
