<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about">About</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#export-formats">Export Formats</a></li>
    <li><a href="#advanced-analysis">Advanced Analysis</a></li>
    <li><a href="#examples">Examples</a></li>
  </ol>
</details>

## About

**project-board-exporter** is a comprehensive tool for extracting GitHub Projects v2 activity and context. It pulls:

- **Project Board Items** - All items with status, priority, and linked content
- **Pull Requests** - Open and recently merged (last 60-90 days) with file changes, linked issues, and review activity
- **Issues** - Open issues with labels, assignees, and linked PRs
- **Commits** - Recent commit history showing engineering effort clustering
- **Documentation** - READMEs from analyzed repositories
- **Analysis & Risks** - Automatic theme detection (AEC, filtering, georeferencing, 3D Tiles, etc.), activity metrics, and risk identification

Perfect for:
- **Context gathering** on complex multi-repo initiatives
- **Status reporting** to stakeholders
- **Risk identification** and team velocity tracking
- **Feeding AI agents** with structured project intelligence

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- GitHub Personal Access Token with `repo`, `read:org`, and `read:project` scopes

### Installation

```bash
git clone https://github.com/stephmarquez-geo/project-board-exporter.git
cd project-board-exporter

npm install
npm run build
```

### Setup

1. Create a GitHub PAT at https://github.com/settings/tokens
   - Required scopes: `repo`, `read:org`, `read:project`

2. Copy `.env.example` to `.env` and add your token:
   ```bash
   cp .env.example .env
   echo "GITHUB_TOKEN=ghp_your_token_here" >> .env
   ```

3. Set environment variable:
   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   ```

## Usage

### Basic Export

```bash
# Export iTwin project 145 with default repos
npm run export:itwin-145

# Or with custom repos
npm start -- --org iTwin --project 145 --repos repo1,repo2,repo3
```

### CLI Options

```bash
node dist/cli.js [options]

Options:
  --org, -o          GitHub organization (default: iTwin)
  --project, -p      Project board number (required)
  --repos, -r        Comma-separated repo names (default: iTwin-core,iTwin-web-viewer)
  --daysBack, -d     Days to look back for merged PRs (default: 90)
  --output, --out    Output directory (default: ./exports)
  --filter, -f       Filter by labels (comma-separated)
  --help, -h         Show help
```

### Examples

```bash
# Export iTwin project 145
npm start -- --org iTwin --project 145

# Export with specific repos and 60-day window
npm start -- --org iTwin --project 145 --repos core,web,mobile --daysBack 60

# Export to custom directory
npm start -- --org iTwin --project 145 --output ~/Documents/exports

# Filter by labels
npm start -- --org iTwin --project 145 --filter "AEC,20-80,experimental"
```

## Export Formats

### JSON Export (`project-context.json`)

Complete structured data for programmatic access:

```json
{
  "projectMetadata": {
    "org": "iTwin",
    "projectNumber": 145,
    "exportedAt": "2026-09-10T22:15:02Z"
  },
  "projectItems": [
    {
      "id": "...",
      "title": "Item Title",
      "body": "Description",
      "status": { "name": "In Progress", "color": "..." },
      "priority": { "name": "High", "color": "..." },
      "content": { "__typename": "Issue", "number": 42, "url": "..." }
    }
  ],
  "openPRs": [ { "number": 123, "title": "...", ... } ],
  "mergedPRsRecent": [ ... ],
  "openIssues": [ ... ],
  "recentCommits": [ ... ],
  "readmes": [ { "repo": "...", "content": "..." } ]
}
```

### Markdown Exports

**project-items.md**
- Project board items organized by status
- Includes priority, dates, and linked issues/PRs

**open-prs.md**
- Open pull requests with file changes, additions/deletions
- Linked issues and PR descriptions

**merged-prs-recent.md**
- PRs merged in last 60-90 days
- Merge dates and activity metrics

**open-issues.md**
- Open issues with labels, assignees
- Linked PRs and descriptions

**recent-commits.md**
- Commit log with authors and file counts
- Useful for activity clustering analysis

**README-[repo].md**
- Extracted README files from analyzed repos

### Analysis Report (`analysis-report.json` & `analysis-report.md`)

Automatic analysis including:

```json
{
  "summary": {
    "totalItems": 142,
    "activeItems": 28,
    "completedItems": 87,
    "stallItems": 5,
    "itemsByStatus": { "Done": 87, "In Progress": 28, ... },
    "prActivity": {
      "openCount": 12,
      "recentMergesCount": 34,
      "avgTimeToMerge": 48.5,
      "topContributors": [...]
    },
    "issueActivity": {
      "openCount": 67,
      "averageAge": 23.4,
      "topLabels": [...]
    }
  },
  "themes": [
    {
      "theme": "AEC",
      "confidence": 0.85,
      "relatedPRs": [123, 124, ...],
      "relatedIssues": [456, 457, ...],
      "relatedItems": ["item-id-1", ...]
    }
  ],
  "keyAreas": {
    "aec": { "prs": [...], "issues": [...], "items": [...] },
    "filtering": { ... },
    "georeferencing": { ... },
    "3dTiles": { ... },
    "realityCapture": { ... },
    "cesium": { ... },
    "designReview": { ... }
  },
  "risks": [
    {
      "title": "Stale PRs",
      "severity": "medium",
      "description": "...",
      "references": [123, 124]
    }
  ],
  "recommendations": [...]
}
```

## Advanced Analysis

The tool automatically detects themes and key focus areas:

- **AEC** - Architecture, Engineering, Construction, BIM
- **Filtering** - Query, search, metadata, readable expressions
- **Georeferencing** - Coordinates, transforms, location, projections
- **3D Tiles** - Tilesets, glTF, point formats
- **Reality Capture** - Photogrammetry, meshes, point clouds, LiDAR
- **Cesium** - Ion integration, cartographic
- **Design Review** - Markup, annotations, reviews

Risk identification for:
- Stale pull requests (14+ days)
- Unassigned issues (orphaned work)
- No recent activity (development stalls)
- High PR volume (review bottlenecks)
- Aging issues (backlog accumulation)

## Integration Examples

### Feed to LLM/AI Agent

```typescript
import { exportProjectContext } from './exporter';

const context = await exportProjectContext({
  org: 'iTwin',
  projectNumber: 145,
  reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],
  token: process.env.GITHUB_TOKEN!
});

// Send to AI agent for analysis
const prompt = `
Analyze this project context and identify:
1. Key themes and focus areas
2. Current blockers or risks
3. Team velocity trends
4. Recommended priorities

Project data:
${JSON.stringify(context, null, 2)}
`;
```

### Import into Excel/Sheets

Use the JSON export with pivot tables:
- Analyze PR metrics by author
- Issue metrics by label
- Activity trends over time

### Create a Dashboard

Combine multiple exports:
```bash
npm start -- --org iTwin --project 145
npm start -- --org iTwin --project 146
npm start -- --org iTwin --project 147

# Merge JSONs and feed to dashboard tool
jq -s 'add' exports-*/project-context.json > combined.json
```

## API Reference

### `exportProjectContext(config)`

Fetch and compile project context.

**Parameters:**
- `org` (string) - GitHub organization
- `projectNumber` (number) - Project board number
- `reposToAnalyze` (string[]) - Repos to analyze
- `daysBack` (number) - Days for PR/commit history
- `token` (string) - GitHub PAT

**Returns:** `Promise<ProjectContext>`

### `exportToFiles(context, outputDir)`

Write exports to disk.

**Parameters:**
- `context` (ProjectContext) - Data from exportProjectContext
- `outputDir` (string) - Output directory

### `generateAdvancedAnalysis(context, outputDir)`

Generate analysis report with themes and risks.

**Parameters:**
- `context` (ProjectContext)
- `outputDir` (string)

## Troubleshooting

### "GITHUB_TOKEN is not set"
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

### "Repository not found or access denied"
- Verify the organization name is correct
- Check PAT has `repo` scope
- Verify you have access to the repository

### "GraphQL query error"
- Token may have expired
- Check API rate limits: `curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit`
- Large exports may hit rate limits; add delays between repo analyses

### Rate Limiting

GitHub GraphQL API has limits. For large exports:
```bash
# Add delay between repo analysis
npm start -- --org iTwin --project 145 --repos repo1 && sleep 60 && npm start -- --org iTwin --project 145 --repos repo2
```

## Future Enhancements

- [ ] Webhook support for real-time updates
- [ ] Database backend for historical trending
- [ ] Custom theme configuration
- [ ] Team velocity metrics
- [ ] Dependency analysis across repos
- [ ] GitHub Actions workflow analysis
- [ ] Discussion/comment sentiment analysis

## License

MIT

## Contributing

Contributions welcome! Feel free to open issues or PRs.

## Support

For issues or questions, open an issue on GitHub or contact @stephmarquez-geo.

---

**Built with ❤️ for better project visibility**
