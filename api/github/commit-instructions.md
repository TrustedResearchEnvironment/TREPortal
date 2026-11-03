# GitHub Actions Setup for HTML Test Reports

## Quick Setup

1. **Create the workflow file:**
   ```bash
   mkdir -p .github/workflows
   cp .github/workflows/ci.yml .github/workflows/ci.yml
   ```

2. **Commit and push:**
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "Add GitHub Actions workflow for HTML test reports"
   git push
   ```

## Accessing HTML Reports

### Option 1: GitHub Actions Artifacts (Easiest)
- Go to your repository → **Actions** tab
- Click on the latest workflow run
- Scroll down to **Artifacts** section
- Download `test-reports-{run_id}` zip file
- Extract and open `htmlcov/index.html` or `test_reports/test_report_*.html`

### Option 2: GitHub Pages (For Public Repos)
- Enable GitHub Pages in repository settings
- Set source to "Deploy from a branch"
- Select `gh-pages` branch
- Access reports at: `https://yourusername.github.io/yourrepo/coverage/{run_number}/`

### Option 3: External Storage
- Use services like:
  - **transfer.sh** (temporary sharing)
  - **AWS S3** or **Azure Blob Storage**
  - **Netlify** or **Vercel** for static hosting

## Example Workflow Commands

```bash
# Check workflow status
gh workflow list
gh workflow view ci.yml

# Download artifacts from latest run
gh run download $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
```

## Advanced Options

### Slack/Discord Notifications
Add notifications when tests fail with report links.

### Automated Cleanup
Configure artifact retention policies.

### Multiple Environments
Run tests on different Python versions and upload separate reports.