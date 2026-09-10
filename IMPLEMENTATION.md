# Project Board Exporter - Implementation Summary

**Repository:** https://github.com/stephmarquez-geo/project-board-exporter

**Status:** ✅ Complete and Ready to Use

---

## What You've Built

A **comprehensive GitHub ProjectsV2 context extraction tool** that pulls:

- 📋 **Project Board Items** - All items with status, priority, linked content
- 🔓 **Pull Requests** - Open + recently merged (60-90 days) with file changes, linked issues
- 🐛 **Issues** - Open issues with labels, assignees, linked PRs
- 📝 **Commits** - Recent commit history showing engineering effort clustering
- 📖 **Documentation** - READMEs from analyzed repositories
- 🎯 **Automatic Analysis** - Theme detection, risk identification, velocity metrics

**Export Formats:**
- 📄 JSON (programmatic access)
- 📊 Markdown (human-readable reports)
- 🔍 Analysis reports (themes, risks, recommendations)

---

## Repository Structure

```
project-board-exporter/
├── README.md                    # Full documentation & API reference
├── WORKFLOW.md                  # Real-world usage workflows
├── package.json                 # npm dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Environment template
├── .gitignore                  # Git configuration
│
├── exporter.ts                 # Main GraphQL query & export logic
├── cli.ts                      # Command-line interface (yargs)
├── advanced-exporter.ts        # Theme analysis & risk detection
├── quick-start.ts              # Example workflows
│
└── dist/                       # Compiled JavaScript (after npm run build)
```

---

## Quick Start

### 1. Setup (5 minutes)

```bash
# Clone
git clone https://github.com/stephmarquez-geo/project-board-exporter.git
cd project-board-exporter

# Install
npm install && npm run build

# Configure
export GITHUB_TOKEN=ghp_your_token_here
```

### 2. Run Export

```bash
# Export iTwin Project 145
npm start -- --org iTwin --project 145 --repos iTwin-core,iTwin-web-viewer

# Or use the preset script
npm run export:itwin-145
```

### 3. Review Results

```
exports/
├── project-context.json         # Raw data (feed to AI agents)
├── analysis-report.md           # 📊 Themes, risks, recommendations
├── open-prs.md                  # 🔓 Open PRs with activity
├── merged-prs-recent.md         # ✅ Merged PRs (last 90 days)
├── open-issues.md               # 🐛 Unresolved issues
├── recent-commits.md            # 📝 Commit log
└── project-items.md             # 📋 Board items by status
```

---

## Core Features

### 1. **Comprehensive Data Extraction**

The GraphQL query fetches:
- ✅ All ProjectsV2 items with custom fields
- ✅ PR metadata, file changes, comments, linked issues
- ✅ Issue metadata, labels, assignees, linked PRs
- ✅ Commit history with author & file counts
- ✅ Repository READMEs

### 2. **Automatic Theme Detection**

Identifies activity clusters:
- **AEC** - Architecture, Engineering, Construction, BIM
- **Filtering** - Query, search, metadata, readable expressions
- **Georeferencing** - Coordinates, transforms, location, projections
- **3D Tiles** - Tilesets, glTF, point formats
- **Reality Capture** - Photogrammetry, meshes, point clouds, LiDAR
- **Cesium** - Ion integration, cartographic
- **Design Review** - Markup, annotations, reviews

### 3. **Risk Identification**

Automatically detects:
- 🔴 Stale PRs (14+ days without updates)
- 🟡 Unassigned Issues (orphaned work)
- 🟠 No Recent Activity (development stalls)
- 🟡 High PR Volume (review bottlenecks)
- 🟡 Aging Issues (backlog accumulation)

### 4. **Activity Metrics**

Extracts:
- PR velocity (open, merged, avg time to merge)
- Top contributors by PR count
- Average issue age
- Item status distribution
- Commit clustering by date

---

## Usage Patterns

### Pattern 1: One-Time Export

```bash
npm start -- \
  --org iTwin \
  --project 145 \
  --repos iTwin-core,iTwin-web-viewer \
  --daysBack 90
```

**Output:** Complete snapshot of project state + analysis

---

### Pattern 2: Daily Exports (Scheduling)

```bash
# Cron job - runs daily at 9 AM
0 9 * * * cd /path/to/exporter && npm start -- --org iTwin --project 145 --output exports/daily-$(date +\%Y\%m\%d)
```

**Output:** Historical trend data for dashboards

---

### Pattern 3: Feed to AI Agents

```javascript
import { exportProjectContext } from './exporter';

const context = await exportProjectContext({
  org: 'iTwin',
  projectNumber: 145,
  reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],
  token: process.env.GITHUB_TOKEN!
});

// Send to Claude, GPT, or your AI agent
const prompt = `
Analyze this iTwin project context:
- Identify strategic themes
- Surface critical blockers
- Assess team health
- Recommend priorities for next sprint

Data: ${JSON.stringify(context, null, 2)}
`;
```

**Output:** AI-powered insights on project state

---

### Pattern 4: Cross-Project Comparison

```bash
# Export multiple projects
for PROJECT in 145 146 147; do
  npm start -- --org iTwin --project $PROJECT
done

# Compare metrics
jq -s 'map({
  project: .projectMetadata.projectNumber,
  activeItems: .summary.activeItems,
  openPRs: .summary.prActivity.openCount,
  risks: (.risks | length)
})' exports/iTwin-*/project-context.json
```

**Output:** Cross-project health dashboard

---

## Key Capabilities

| Capability | What It Does | Output |
|---|---|---|
| **GraphQL Queries** | Fetches all ProjectsV2 data with pagination | `project-context.json` |
| **Theme Analysis** | Matches keywords to detect focus areas (AEC, filtering, etc) | `analysis-report.json` |
| **Risk Detection** | Identifies stale PRs, unassigned issues, activity gaps | `analysis-report.md` |
| **Markdown Reports** | Human-readable summaries by type (PRs, issues, commits) | `*.md` files |
| **CLI Interface** | Easy command-line control with multiple options | `npm start -- [options]` |
| **Pagination** | Handles 100+ items per request with cursor-based pagination | N/A |
| **Rate Limiting** | Respects GitHub API limits with proper error handling | Console warnings |

---

## For Your Use Case

Based on your original request about capturing **20/80 activity & context**:

### This Tool Delivers:

✅ **Open PRs + recently merged (60-90 days)** — Shows active development focus  
✅ **Open issues tagged with AEC, filtering, georeferencing, etc** — Exposes gaps  
✅ **Recent commit history** — Where engineering effort clusters  
✅ **README/docs** — Distinguishes experiments vs. intended product  
✅ **Project board export** — Team's intended statuses & ownership  
✅ **Risk identification** — Blockers, stalled items, velocity trends  

### Recommended Integration:

1. **Daily Export** (cron/GitHub Actions) — keeps data fresh
2. **Feed to Claude/GPT** — get AI insights on themes & blockers
3. **Create Dashboard** — merge exports, visualize trends
4. **Alert on Risks** — notify when high-severity issues appear

---

## API Reference

### `exportProjectContext(config)`

Fetches all project data.

```typescript
const context = await exportProjectContext({
  org: 'iTwin',
  projectNumber: 145,
  reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],
  daysBack: 90,
  token: process.env.GITHUB_TOKEN!
});
```

**Returns:** `ProjectContext` with items, PRs, issues, commits, analysis

### `exportToFiles(context, outputDir)`

Writes to disk.

```typescript
await exportToFiles(context, './exports/iTwin-145');
```

**Outputs:** All markdown and JSON files

### `generateAdvancedAnalysis(context, outputDir)`

Generates theme & risk analysis.

```typescript
await generateAdvancedAnalysis(context, './exports/iTwin-145');
```

**Outputs:** `analysis-report.json`, `analysis-report.md`

---

## Extending the Tool

### Add Custom Themes

Edit `advanced-exporter.ts`:

```typescript
const THEME_KEYWORDS = {
  aec: ['AEC', 'architecture', ...],
  myTheme: ['keyword1', 'keyword2', ...],  // Add here
  // ...
};
```

### Add Custom Metrics

Modify `generateSummaryStats()` in `advanced-exporter.ts` to calculate additional metrics.

### Add Custom Filters

Modify `exportProjectContext()` in `exporter.ts` to filter items before export.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `GITHUB_TOKEN not set` | `export GITHUB_TOKEN=ghp_...` |
| Rate limit hit | Add delays between repo analysis: `sleep 60` |
| No project data | Verify org/project number and token has `read:project` scope |
| GraphQL errors | Check token hasn't expired; verify repo access |
| Large exports time out | Reduce `daysBack` or analyze fewer repos per run |

See [WORKFLOW.md](./WORKFLOW.md) for detailed troubleshooting.

---

## Next Steps

1. ✅ **Run First Export**
   ```bash
   npm run export:itwin-145
   ```

2. 🔍 **Review Analysis**
   ```bash
   cat exports/project-context.json | jq '.summary'
   ```

3. 🤖 **Feed to AI Agent**
   ```bash
   # Use project-context.json as context in Claude/GPT
   ```

4. ⏰ **Automate**
   ```bash
   # Set up cron job or GitHub Action for daily exports
   ```

5. 📊 **Build Dashboard**
   ```bash
   # Use exported data to create visualizations
   ```

---

## Documentation

- **[README.md](./README.md)** - Full documentation, API reference, examples
- **[WORKFLOW.md](./WORKFLOW.md)** - Real-world workflows, scripts, automation
- **[package.json](./package.json)** - npm scripts and dependencies
- **[exporter.ts](./exporter.ts)** - Core GraphQL queries and logic
- **[advanced-exporter.ts](./advanced-exporter.ts)** - Theme analysis & risk detection

---

## Repository

🔗 **GitHub:** https://github.com/stephmarquez-geo/project-board-exporter

Clone, customize, and integrate into your workflow!

---

**Built for comprehensive project visibility. Perfect for feeding AI agents with real-time context.**
