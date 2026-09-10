import { exportProjectContext, ProjectContext } from './exporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced export features for deeper context extraction
 */

interface AnalysisReport {
  summary: SummaryStats;
  themes: ThemeAnalysis[];
  keyAreas: KeyAreaAnalysis;
  activityTimeline: ActivityTimelineEntry[];
  risks: RiskIdentification[];
  recommendations: string[];
}

interface SummaryStats {
  totalItems: number;
  activeItems: number;
  completedItems: number;
  stallItems: number;
  itemsByStatus: Record<string, number>;
  prActivity: {
    openCount: number;
    recentMergesCount: number;
    avgTimeToMerge: number;
    topContributors: { author: string; prCount: number }[];
  };
  issueActivity: {
    openCount: number;
    averageAge: number;
    topLabels: { label: string; count: number }[];
  };
}

interface ThemeAnalysis {
  theme: string;
  keywords: string[];
  relatedPRs: number[];
  relatedIssues: number[];
  relatedItems: string[];
  confidence: number;
}

interface KeyAreaAnalysis {
  aec: { prs: number[]; issues: number[]; items: string[] };
  filtering: { prs: number[]; issues: number[]; items: string[] };
  georeferencing: { prs: number[]; issues: number[]; items: string[] };
  '3dTiles': { prs: number[]; issues: number[]; items: string[] };
  realityCapture: { prs: number[]; issues: number[]; items: string[] };
  cesium: { prs: number[]; issues: number[]; items: string[] };
  designReview: { prs: number[]; issues: number[]; items: string[] };
}

interface ActivityTimelineEntry {
  date: string;
  prsMerged: number;
  issuesCreated: number;
  commitsCount: number;
  contributors: string[];
}

interface RiskIdentification {
  title: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  references: (string | number)[];
}

const THEME_KEYWORDS = {
  aec: ['AEC', 'architecture', 'engineering', 'construction', 'BIM', 'building'],
  filtering: ['filter', 'query', 'search', 'metadata', 'readable', 'expression'],
  georeferencing: ['geo', 'coordinate', 'transform', 'georef', 'location', 'projection'],
  '3dTiles': ['3d tiles', '3dtiles', 'tileset', 'b3dm', 'i3dm', 'pnts', 'glTF'],
  realityCapture: ['reality', 'capture', 'photogrammetry', 'mesh', 'point cloud', 'lidar'],
  cesium: ['cesium', 'ion', 'cartographic'],
  designReview: ['design review', 'design-review', 'review', 'markup', 'annotation']
};

function analyzeThemes(context: ProjectContext): ThemeAnalysis[] {
  const themes: ThemeAnalysis[] = [];

  Object.entries(THEME_KEYWORDS).forEach(([themeName, keywords]) => {
    const relatedPRs: number[] = [];
    const relatedIssues: number[] = [];
    const relatedItems: string[] = [];
    let matchCount = 0;

    context.openPRs.forEach(pr => {
      const text = `${pr.title} ${pr.body}`.toLowerCase();
      const keywordMatches = keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (keywordMatches.length > 0) {
        relatedPRs.push(pr.number);
        matchCount += keywordMatches.length;
      }
    });

    context.mergedPRsRecent.forEach(pr => {
      const text = `${pr.title} ${pr.body}`.toLowerCase();
      const keywordMatches = keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (keywordMatches.length > 0) {
        relatedPRs.push(pr.number);
        matchCount += keywordMatches.length;
      }
    });

    context.openIssues.forEach(issue => {
      const text = `${issue.title} ${issue.body}`.toLowerCase();
      const keywordMatches = keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (keywordMatches.length > 0) {
        relatedIssues.push(issue.number);
        matchCount += keywordMatches.length;
      }
    });

    context.projectItems.forEach(item => {
      const text = `${item.title} ${item.body || ''}`.toLowerCase();
      const keywordMatches = keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (keywordMatches.length > 0) {
        relatedItems.push(item.id);
        matchCount += keywordMatches.length;
      }
    });

    if (matchCount > 0) {
      themes.push({
        theme: themeName,
        keywords,
        relatedPRs,
        relatedIssues,
        relatedItems,
        confidence: Math.min(1, matchCount / 10)
      });
    }
  });

  return themes.sort((a, b) => b.confidence - a.confidence);
}

function generateSummaryStats(context: ProjectContext): SummaryStats {
  const statuses = new Map<string, number>();
  context.projectItems.forEach(item => {
    const status = item.status?.name || 'No Status';
    statuses.set(status, (statuses.get(status) || 0) + 1);
  });

  const topContributors = new Map<string, number>();
  context.openPRs.forEach(pr => {
    topContributors.set(pr.author, (topContributors.get(pr.author) || 0) + 1);
  });

  const topLabels = new Map<string, number>();
  context.openIssues.forEach(issue => {
    issue.labels.forEach(label => {
      topLabels.set(label, (topLabels.get(label) || 0) + 1);
    });
  });

  const mergeTimestamps = context.mergedPRsRecent.filter(pr => pr.mergedAt).map(pr => {
    const created = new Date(pr.createdAt).getTime();
    const merged = new Date(pr.mergedAt!).getTime();
    return (merged - created) / (1000 * 60 * 60);
  });

  return {
    totalItems: context.projectItems.length,
    activeItems: Array.from(statuses.get('In Progress') || 0),
    completedItems: Array.from(statuses.get('Done') || 0),
    stallItems: context.openIssues.filter(i => {
      const age = (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return age > 30 && i.assignees.length === 0;
    }).length,
    itemsByStatus: Object.fromEntries(statuses),
    prActivity: {
      openCount: context.openPRs.length,
      recentMergesCount: context.mergedPRsRecent.length,
      avgTimeToMerge: mergeTimestamps.length > 0 ? mergeTimestamps.reduce((a, b) => a + b) / mergeTimestamps.length : 0,
      topContributors: Array.from(topContributors.entries())
        .map(([author, count]) => ({ author, prCount: count }))
        .sort((a, b) => b.prCount - a.prCount)
        .slice(0, 10)
    },
    issueActivity: {
      openCount: context.openIssues.length,
      averageAge: context.openIssues.length > 0 
        ? context.openIssues.reduce((sum, i) => sum + (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24), 0) / context.openIssues.length
        : 0,
      topLabels: Array.from(topLabels.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }
  };
}

function identifyRisks(context: ProjectContext): RiskIdentification[] {
  const risks: RiskIdentification[] = [];

  const stalePRs = context.openPRs.filter(pr => {
    const days = (Date.now() - new Date(pr.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days > 14;
  });

  if (stalePRs.length > 0) {
    risks.push({
      title: `${stalePRs.length} Stale Pull Requests`,
      severity: stalePRs.length > 5 ? 'high' : 'medium',
      description: `${stalePRs.length} open PRs haven't been updated in 14+ days. Review for merge or closure.`,
      references: stalePRs.slice(0, 5).map(pr => pr.number)
    });
  }

  const unassigned = context.openIssues.filter(i => i.assignees.length === 0);
  if (unassigned.length > 10) {
    risks.push({
      title: `${unassigned.length} Unassigned Issues`,
      severity: 'medium',
      description: `Many issues lack assignees. Risk of duplicate effort or overlooked work.`,
      references: unassigned.slice(0, 5).map(i => i.number)
    });
  }

  const hasRecentActivity = context.recentCommits.some(c => {
    const days = (Date.now() - new Date(c.date).getTime()) / (1000 * 60 * 60 * 24);
    return days < 7;
  });

  if (!hasRecentActivity && context.recentCommits.length > 0) {
    risks.push({
      title: 'No Recent Commit Activity',
      severity: 'high',
      description: 'No commits in the last 7 days. Check if development has stalled or moved.',
      references: []
    });
  }

  return risks;
}

function generateAnalysisReport(context: ProjectContext): AnalysisReport {
  const summary = generateSummaryStats(context);
  const themes = analyzeThemes(context);
  
  const keyAreas: KeyAreaAnalysis = {
    aec: { prs: [], issues: [], items: [] },
    filtering: { prs: [], issues: [], items: [] },
    georeferencing: { prs: [], issues: [], items: [] },
    '3dTiles': { prs: [], issues: [], items: [] },
    realityCapture: { prs: [], issues: [], items: [] },
    cesium: { prs: [], issues: [], items: [] },
    designReview: { prs: [], issues: [], items: [] }
  };

  themes.forEach(theme => {
    if (keyAreas[theme.theme as keyof KeyAreaAnalysis]) {
      keyAreas[theme.theme as keyof KeyAreaAnalysis] = {
        prs: theme.relatedPRs,
        issues: theme.relatedIssues,
        items: theme.relatedItems
      };
    }
  });

  const risks = identifyRisks(context);

  const recommendations: string[] = [];
  if (risks.length > 0) {
    recommendations.push(`Address ${risks.length} identified risks`);
  }
  if (summary.stallItems > 5) {
    recommendations.push('Review and re-prioritize stalled items');
  }
  if (summary.prActivity.openCount > 20) {
    recommendations.push('High PR volume - consider review load balancing');
  }
  if (summary.issueActivity.averageAge > 30) {
    recommendations.push('Average issue age is 30+ days - accelerate issue resolution');
  }

  return {
    summary,
    themes,
    keyAreas,
    activityTimeline: [],
    risks,
    recommendations
  };
}

function formatAnalysisReportMarkdown(report: AnalysisReport): string {
  let md = '# Project Analysis Report\n\n';
  
  md += '## 📊 Summary Statistics\n\n';
  md += `- **Total Project Items:** ${report.summary.totalItems}\n`;
  md += `- **Active Items:** ${report.summary.activeItems}\n`;
  md += `- **Completed Items:** ${report.summary.completedItems}\n`;
  md += `- **Stalled Items:** ${report.summary.stallItems}\n\n`;
  
  md += '### Items by Status\n';
  Object.entries(report.summary.itemsByStatus).forEach(([status, count]) => {
    md += `- ${status}: ${count}\n`;
  });

  md += '\n### PR Activity\n';
  md += `- **Open PRs:** ${report.summary.prActivity.openCount}\n`;
  md += `- **Recently Merged:** ${report.summary.prActivity.recentMergesCount}\n`;
  md += `- **Avg Time to Merge:** ${report.summary.prActivity.avgTimeToMerge.toFixed(2)} hours\n`;
  md += `- **Top Contributors:**\n`;
  report.summary.prActivity.topContributors.forEach(c => {
    md += `  - @${c.author}: ${c.prCount} PRs\n`;
  });

  md += '\n### Issue Activity\n';
  md += `- **Open Issues:** ${report.summary.issueActivity.openCount}\n`;
  md += `- **Average Issue Age:** ${report.summary.issueActivity.averageAge.toFixed(1)} days\n`;
  md += `- **Top Labels:**\n`;
  report.summary.issueActivity.topLabels.forEach(l => {
    md += `  - ${l.label}: ${l.count}\n`;
  });

  md += '\n## 🎯 Themes & Focus Areas\n\n';
  report.themes.forEach(theme => {
    md += `### ${theme.theme} (${(theme.confidence * 100).toFixed(0)}% confidence)\n`;
    md += `- **Keywords:** ${theme.keywords.join(', ')}\n`;
    if (theme.relatedPRs.length > 0) {
      md += `- **Related PRs:** ${theme.relatedPRs.slice(0, 10).join(', ')}\n`;
    }
    if (theme.relatedIssues.length > 0) {
      md += `- **Related Issues:** ${theme.relatedIssues.slice(0, 10).join(', ')}\n`;
    }
    md += '\n';
  });

  if (report.risks.length > 0) {
    md += '\n## ⚠️ Identified Risks\n\n';
    report.risks.forEach(risk => {
      const icon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
      md += `### ${icon} ${risk.title}\n`;
      md += `**Severity:** ${risk.severity}\n\n`;
      md += `${risk.description}\n`;
      if (risk.references.length > 0) {
        md += `\nReferences: ${risk.references.slice(0, 5).join(', ')}\n`;
      }
      md += '\n';
    });
  }

  if (report.recommendations.length > 0) {
    md += '\n## 💡 Recommendations\n\n';
    report.recommendations.forEach(rec => {
      md += `- ${rec}\n`;
    });
  }

  return md;
}

export async function generateAdvancedAnalysis(context: ProjectContext, outputDir: string = './exports'): Promise<void> {
  const report = generateAnalysisReport(context);
  
  fs.writeFileSync(
    path.join(outputDir, 'analysis-report.json'),
    JSON.stringify(report, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'analysis-report.md'),
    formatAnalysisReportMarkdown(report)
  );

  console.log('✅ Analysis report generated');
}

export { generateAnalysisReport, analyzeThemes, generateSummaryStats, identifyRisks };
