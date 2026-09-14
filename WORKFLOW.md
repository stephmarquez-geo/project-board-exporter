# Workflow Guide: Using project-board-exporter with iTwin Project 145

This guide walks through real-world workflows for extracting and analyzing project context from iTwin's Project 145.

## Table of Contents

1. [Setup](#setup)
2. [Basic Export Workflow](#basic-export-workflow)
3. [Activity Analysis Workflow](#activity-analysis-workflow)
4. [Theme-Based Investigation](#theme-based-investigation)
5. [Risk Identification & Reporting](#risk-identification--reporting)
6. [Feeding AI Agents](#feeding-ai-agents)
7. [Cross-Project Analysis](#cross-project-analysis)
8. [Automation & Scheduling](#automation--scheduling)

---

## Setup

### 1. Prerequisites

```bash
# Clone the repository
git clone https://github.com/stephmarquez-geo/project-board-exporter.git
cd project-board-exporter

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. GitHub Token

Create a Personal Access Token with these scopes:
- `repo` - Full control of private repositories
- `read:org` - Read organization members
- `read:project` - Read GitHub Projects

Go to: https://github.com/settings/tokens/new

```bash
# Add to .env or export
export GITHUB_TOKEN=ghp_your_token_here
```

### 3. Verify Setup

```bash
npm start -- --org iTwin --project 145 --help
```

---

## Basic Export Workflow

### Goal
Get a complete snapshot of Project 145 with all items, PRs, issues, and recent commits.

### Steps

```bash
# 1. Create output directory
mkdir -p exports/iTwin-145-$(date +%Y%m%d)

# 2. Run export
export GITHUB_TOKEN=ghp_your_token_here
npm start -- \
  --org iTwin \
  --project 145 \
  --repos iTwin-core,iTwin-web-viewer \
  --daysBack 90 \
  --output exports/iTwin-145-$(date +%Y%m%d)

# 3. Files generated
# - project-context.json (raw data)
# - project-items.md (board items by status)
# - open-prs.md (open pull requests)
# - merged-prs-recent.md (last 90 days of merged PRs)
# - open-issues.md (open issues)
# - recent-commits.md (commit history)
# - README-*.md (extracted repo documentation)
# - analysis-report.json (structured analysis)
# - analysis-report.md (human-readable analysis)
```

### Output Structure

```
exports/iTwin-145-20260910/
├── project-context.json          # Full JSON export (programmatic access)
├── analysis-report.json          # Theme analysis & risks
├── analysis-report.md            # 📊 Themes, risks, recommendations
├── project-items.md              # 📋 Project board items by status
├── open-prs.md                   # 🔓 Open pull requests
├── merged-prs-recent.md          # ✅ Recently merged PRs (90d)
├── open-issues.md                # 🐛 Open issues
├── recent-commits.md             # 📝 Commit history
└── README-iTwin-core.md          # 📖 Repo documentation
```

### Inspect Results

```bash
# View summary statistics
cat exports/iTwin-145-*/analysis-report.md | head -50

# Check for risks
grep -A5 "🔴\|🟡" exports/iTwin-145-*/analysis-report.md

# List top PR contributors
jq '.summary.prActivity.topContributors' exports/iTwin-145-*/project-context.json

# Count items by status
jq '.summary.itemsByStatus' exports/iTwin-145-*/analysis-report.json
```

---

## Activity Analysis Workflow

### Goal
Understand engineering velocity, identify bottlenecks, and track team effort.

### Metrics to Extract

```bash
# 1. PR Velocity
jq '.summary.prActivity | {openCount, recentMergesCount, avgTimeToMerge}' \
  exports/iTwin-145-*/project-context.json

# 2. Issue Age & Assignment
jq '.summary.issueActivity | {openCount, averageAge}' \
  exports/iTwin-145-*/project-context.json

# 3. Top Contributors (last 90 days)
jq '.summary.prActivity.topContributors[] | "\(.author): \(.prCount) PRs"' \
  exports/iTwin-145-*/project-context.json

# 4. Commit Clustering (shows where effort is concentrated)
jq '.recentCommits[] | .message' \
  exports/iTwin-145-*/project-context.json | head -20

# 5. Merge Time Analysis (hours from creation to merge)
jq '.mergedPRsRecent[] | {number: .number, title: .title, avgMergeHours: ((.mergedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)) / 3600}' \
  exports/iTwin-145-*/project-context.json
```

### Velocity Dashboard Script

```bash
#!/bin/bash
# save as: scripts/velocity-report.sh

EXPORT_DIR=$1

echo "=== Project 145 Velocity Report ==="
echo ""
echo "📊 PR Metrics:"
jq -r '.summary.prActivity | "- Open: \(.openCount)\n- Merged (90d): \(.recentMergesCount)\n- Avg Time to Merge: \(.avgTimeToMerge | round) hours"' \
  $EXPORT_DIR/project-context.json

echo ""
echo "🔧 Top Contributors:"
jq -r '.summary.prActivity.topContributors[] | "- @\(.author): \(.prCount) PRs"' \
  $EXPORT_DIR/project-context.json

echo ""
echo "🐛 Issue Metrics:"
jq -r '.summary.issueActivity | "- Open: \(.openCount)\n- Avg Age: \(.averageAge | round) days"' \
  $EXPORT_DIR/project-context.json

echo ""
echo "⚠️ Risks:"
jq -r '.risks[] | "[\(.severity | ascii_upcase)] \(.title)\n  → \(.description)"' \
  $EXPORT_DIR/analysis-report.json
```

Run it:
```bash
bash scripts/velocity-report.sh exports/iTwin-145-20260910
```

---

## Theme-Based Investigation

### Goal
Deep-dive into specific focus areas (AEC, filtering, georeferencing, etc.)

### Supported Themes

- **AEC** - Architecture, Engineering, Construction, BIM
- **Filtering** - Query, search, metadata, readable expressions
- **Georeferencing** - Coordinates, transforms, location, projections
- **3D Tiles** - Tilesets, glTF, point formats
- **Reality Capture** - Photogrammetry, meshes, point clouds, LiDAR
- **Cesium** - Ion integration, cartographic
- **Design Review** - Markup, annotations, reviews

### Extract Theme Context

```bash
EXPORT_DIR="exports/iTwin-145-20260910"

# 1. Find all AEC-related activity
jq '.themes[] | select(.theme == "aec")' $EXPORT_DIR/analysis-report.json

# 2. Get confidence score (higher = more relevant)
jq '.themes[] | {theme, confidence}' $EXPORT_DIR/analysis-report.json | \
  sort -k3 -rn | head -10

# 3. List related PRs for a theme
jq '.keyAreas.aec.prs[]' $EXPORT_DIR/analysis-report.json | \
  xargs -I {} jq -r '.openPRs[] | select(.number == {}) | "#\(.number): \(.title)"' \
  $EXPORT_DIR/project-context.json

# 4. Find stalled work in a theme
jq '.keyAreas.filtering.issues[]' $EXPORT_DIR/analysis-report.json | \
  xargs -I {} jq -r '.openIssues[] | select(.number == {})' \
  $EXPORT_DIR/project-context.json
```

### Theme Report Script

```bash
#!/bin/bash
# save as: scripts/theme-report.sh
# Usage: bash scripts/theme-report.sh exports/iTwin-145-20260910 aec

EXPORT_DIR=$1
THEME=$2

echo "=== Theme: ${THEME^^} ==="
echo ""

echo "📋 Overview:"
jq -r ".themes[] | select(.theme == \"$THEME\") | \"Confidence: \(.confidence * 100)%\n Keywords: \(.keywords | join(\", \"))\"" \
  $EXPORT_DIR/analysis-report.json

echo ""
echo "🔓 Related Open PRs:"
jq -r ".keyAreas.${THEME}.prs[]" $EXPORT_DIR/analysis-report.json | \
  head -10

echo ""
echo "🐛 Related Open Issues:"
jq -r ".keyAreas.${THEME}.issues[]" $EXPORT_DIR/analysis-report.json | \
  head -10
```

---

## Risk Identification & Reporting

### Goal
Surface blockers, stalled work, and team bottlenecks.

### Automatic Risk Detection

Risks are automatically identified:

- **Stale PRs** (14+ days without updates)
- **Unassigned Issues** (orphaned work)
- **No Recent Activity** (development stalls)
- **High PR Volume** (review bottlenecks)
- **Aging Issues** (backlog accumulation)

### Extract & Report Risks

```bash
EXPORT_DIR="exports/iTwin-145-20260910"

# 1. All risks (JSON)
jq '.risks[]' $EXPORT_DIR/analysis-report.json

# 2. High-severity risks only
jq '.risks[] | select(.severity == "high")' $EXPORT_DIR/analysis-report.json

# 3. Risk summary for reporting
jq -r '.risks[] | "\(.severity | ascii_upcase): \(.title)\n  \(.description)\n"' \
  $EXPORT_DIR/analysis-report.json

# 4. Specific risk details with references
jq -r '.risks[0] | "Title: \(.title)\nSeverity: \(.severity)\nReferences: \(.references | join(", "))"' \
  $EXPORT_DIR/analysis-report.json
```

### Risk Dashboard

```bash
#!/bin/bash
# save as: scripts/risk-dashboard.sh

EXPORT_DIR=$1

echo "╔════════════════════════════════════════╗"
echo "║   Project 145 Risk Dashboard           ║"
echo "╚════════════════════════════════════════╝"
echo ""

HIGH=$(jq '[.risks[] | select(.severity == "high")] | length' $EXPORT_DIR/analysis-report.json)
MED=$(jq '[.risks[] | select(.severity == "medium")] | length' $EXPORT_DIR/analysis-report.json)
LOW=$(jq '[.risks[] | select(.severity == "low")] | length' $EXPORT_DIR/analysis-report.json)

echo "🔴 HIGH: $HIGH risks"
echo "🟡 MEDIUM: $MED risks"
echo "🟢 LOW: $LOW risks"
echo ""

if [ "$HIGH" -gt 0 ]; then
  echo "⚠️  High-Severity Risks:"
  jq -r '.risks[] | select(.severity == "high") | "  • \(.title)"' \
    $EXPORT_DIR/analysis-report.json
  echo ""
fi

echo "📈 Velocity:"
jq -r '.summary.prActivity | "  • Open PRs: \(.openCount) | Merged (90d): \(.recentMergesCount) | Avg Merge: \(.avgTimeToMerge | round)h"' \
  $EXPORT_DIR/analysis-report.json

echo ""
echo "💡 Recommendations:"
jq -r '.recommendations[] | "  • \(.)"' $EXPORT_DIR/analysis-report.json
```

---

## Feeding AI Agents

### Goal
Use exported data as context for AI-powered analysis and decision-making.

### JSON for Claude/GPT

```bash
# 1. Prepare structured context
jq '{
  projectMetadata: .projectMetadata,
  summary: .summary,
  themes: .themes,
  risks: .risks | map({title, severity, description}),
  recommendations: .recommendations,
  recentActivity: {
    openPRs: .openPRs | length,
    mergedPRs: .mergedPRsRecent | length,
    openIssues: .openIssues | length,
    commits: .recentCommits | length
  }
}' exports/iTwin-145-20260910/analysis-report.json > context.json

# 2. Feed to Claude via API
cat > analyze.sh << 'EOF'
#!/bin/bash
CONTEXT=$(cat context.json)

curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"claude-3-sonnet-20240229\",
    \"max_tokens\": 2048,
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"Analyze this project context and identify: 1) Strategic themes, 2) Critical blockers, 3) Team health signals, 4) Recommended priorities for the next sprint.\\n\\nContext:\\n$CONTEXT\"
    }]
  }"
EOF

bash analyze.sh
```

### Markdown Report for Review

```bash
# Create a comprehensive briefing document
cat > exports/iTwin-145-20260910/BRIEFING.md << 'EOF'
# iTwin Project 145 - Project Briefing

## Executive Summary

Generated: $(date)

### Key Metrics
- **Total Items:** $(jq '.summary.totalItems' $EXPORT_DIR/analysis-report.json)
- **Active Work:** $(jq '.summary.activeItems' analysis-report.json) items in progress
- **Completed:** $(jq '.summary.completedItems' analysis-report.json) items done
- **Open PRs:** $(jq '.summary.prActivity.openCount' analysis-report.json)
- **Average Issue Age:** $(jq '.summary.issueActivity.averageAge' analysis-report.json | round) days

$(cat exports/iTwin-145-20260910/analysis-report.md)
EOF
```

---

## Cross-Project Analysis

### Goal
Compare velocity, themes, and health across multiple projects.

### Multi-Project Export

```bash
# Export multiple projects at once
for PROJECT in 145 146 147; do
  npm start -- \
    --org iTwin \
    --project $PROJECT \
    --repos iTwin-core,iTwin-web-viewer \
    --output exports/iTwin-$PROJECT-$(date +%Y%m%d)
done

# Merge all reports
jq -s 'map({
  project: .projectMetadata.projectNumber,
  items: .summary.totalItems,
  openPRs: .summary.prActivity.openCount,
  mergedPRs: .summary.prActivity.recentMergesCount,
  risks: (.risks | length)
})' exports/iTwin-*/project-context.json > cross-project.json

# Display comparison
jq -r '.[] | "\(.project): \(.items) items | \(.openPRs) open PRs | \(.risks) risks"' \
  cross-project.json
```

---

## Automation & Scheduling

### Daily Export Script

```bash
#!/bin/bash
# save as: scripts/daily-export.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="exports/iTwin-145-$TIMESTAMP"
mkdir -p "$EXPORT_DIR"

# Run export
npm start -- \
  --org iTwin \
  --project 145 \
  --repos iTwin-core,iTwin-web-viewer \
  --output "$EXPORT_DIR"

# Archive previous export (keep last 7 days)
find exports/iTwin-145-* -mtime +7 -type d -exec rm -rf {} +

# Notify (optional)
echo "✅ Export complete: $EXPORT_DIR"
```

### Cron Job

```bash
# Add to crontab: crontab -e

# Daily export at 9 AM
0 9 * * * cd /path/to/project-board-exporter && bash scripts/daily-export.sh

# Weekly comparison on Mondays
0 9 * * 1 cd /path/to/project-board-exporter && npm start -- --org iTwin --project 145 --output exports/weekly/iTwin-145-$(date +\%Y\%m\%d)
```

### GitHub Action Workflow

```yaml
# .github/workflows/export-project-145.yml

name: Export Project 145

on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
  workflow_dispatch:

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build
      
      - name: Export Project 145
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm start -- \
            --org iTwin \
            --project 145 \
            --output exports/iTwin-145-$(date +%Y%m%d)
      
      - name: Commit & Push
        run: |
          git config user.name "Export Bot"
          git config user.email "bot@example.com"
          git add exports/
          git commit -m "chore: daily project export $(date +%Y-%m-%d)"
          git push
```

### Weekly Customer Engagement Workflow

For issue-based customer engagement tracking, use the scheduled workflow in `/home/runner/work/project-board-exporter/project-board-exporter/.github/workflows/weekly-customer-engagement-summary.yml`.

It:

1. runs every Monday
2. summarizes issue and comment activity for `iTwin/cesium-bim-cad`
3. writes dated reports plus `latest.md` and `latest.json`
4. publishes the markdown summary to the workflow job summary

---

## Troubleshooting

### Common Issues

**Rate limit hit**
```bash
# GitHub GraphQL has limits. Add delays:
npm start -- --org iTwin --project 145 --repos iTwin-core
sleep 60
npm start -- --org iTwin --project 145 --repos iTwin-web-viewer
```

**Token expired**
```bash
# Generate new PAT at https://github.com/settings/tokens
export GITHUB_TOKEN=ghp_new_token_here
npm start -- --org iTwin --project 145
```

**No project data**
```bash
# Verify project exists and you have access
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/orgs/iTwin/projectsV2
```

---

## Next Steps

1. ✅ Run your first export
2. 📊 Review `analysis-report.md` for themes & risks
3. 🤖 Feed `project-context.json` to an AI agent
4. ⏰ Set up automation with cron or GitHub Actions
5. 📈 Create dashboards from exported data

**Questions?** Check the [README](./README.md) or open an issue.
