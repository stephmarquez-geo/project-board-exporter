#!/usr/bin/env node

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface CLIArgs {
  owner: string;
  repo: string;
  days: number;
  output: string;
  limit: number;
}

interface IssueApiResponse {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  body: string | null;
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  pull_request?: unknown;
}

interface CommentApiResponse {
  issue_url: string;
  created_at: string;
  user: { login: string } | null;
}

interface EngagementIssue {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  author: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  labels: string[];
  assignees: string[];
  comments: number;
  newComments: number;
  excerpt: string;
}

interface WeeklyEngagementSummary {
  metadata: {
    owner: string;
    repo: string;
    generatedAt: string;
    windowDays: number;
    windowStart: string;
    windowEnd: string;
  };
  metrics: {
    issuesTouched: number;
    newIssues: number;
    closedIssues: number;
    activeOpenIssues: number;
    unassignedActiveIssues: number;
    newComments: number;
    uniqueCommenters: number;
  };
  topLabels: Array<{ label: string; count: number }>;
  topCommenters: Array<{ login: string; count: number }>;
  mostDiscussedIssues: EngagementIssue[];
  newIssues: EngagementIssue[];
  closedIssues: EngagementIssue[];
  activeIssues: EngagementIssue[];
  unassignedActiveIssues: EngagementIssue[];
}

const argv = yargs(hideBin(process.argv))
  .option('owner', {
    description: 'GitHub repository owner',
    type: 'string',
    default: 'iTwin'
  })
  .option('repo', {
    description: 'GitHub repository name',
    type: 'string',
    default: 'cesium-bim-cad'
  })
  .option('days', {
    description: 'Number of trailing days to summarize',
    type: 'number',
    default: 7
  })
  .option('output', {
    alias: 'out',
    description: 'Output directory for summary files',
    type: 'string',
    default: './reports/customer-engagements'
  })
  .option('limit', {
    description: 'Maximum number of issues to include per section',
    type: 'number',
    default: 10
  })
  .help()
  .alias('help', 'h')
  .parseSync() as unknown as CLIArgs;

function buildHeaders(token: string): Record<string, string> {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `******
    'User-Agent': 'project-board-exporter'
  };
}

async function fetchPaginated<T>(url: URL, token: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    url.searchParams.set('page', String(page));
    const response = await fetch(url.toString(), { headers: buildHeaders(token) });

    if (!response.ok) {
      throw new Error(`GitHub API request failed (${response.status}): ${await response.text()}`);
    }

    const pageItems = await response.json() as T[];
    items.push(...pageItems);

    if (pageItems.length < Number(url.searchParams.get('per_page') || 100)) {
      break;
    }

    page += 1;
  }

  return items;
}

async function fetchRecentlyUpdatedIssues(owner: string, repo: string, since: string, token: string): Promise<IssueApiResponse[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  url.searchParams.set('state', 'all');
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('direction', 'desc');
  url.searchParams.set('since', since);
  url.searchParams.set('per_page', '100');

  const issues = await fetchPaginated<IssueApiResponse>(url, token);
  return issues.filter(issue => !issue.pull_request);
}

async function fetchRecentIssueComments(owner: string, repo: string, since: string, token: string): Promise<CommentApiResponse[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues/comments`);
  url.searchParams.set('sort', 'created');
  url.searchParams.set('direction', 'desc');
  url.searchParams.set('since', since);
  url.searchParams.set('per_page', '100');

  return fetchPaginated<CommentApiResponse>(url, token);
}

function formatIssue(issue: IssueApiResponse, newComments: number): EngagementIssue {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    author: issue.user?.login || 'unknown',
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    labels: issue.labels.map(label => label.name),
    assignees: issue.assignees.map(assignee => assignee.login),
    comments: issue.comments,
    newComments,
    excerpt: summarizeText(issue.body)
  };
}

function summarizeText(text: string | null | undefined, maxLength: number = 180): string {
  const normalized = (text || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return 'No description provided.';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();

  items.forEach(item => {
    const key = getKey(item);
    if (!key) {
      return;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function buildSummary(
  owner: string,
  repo: string,
  days: number,
  issues: IssueApiResponse[],
  comments: CommentApiResponse[],
  limit: number
): WeeklyEngagementSummary {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);
  const windowStartIso = windowStart.toISOString();

  const issueNumbers = new Set(issues.map(issue => issue.number));
  const commentCounts = new Map<number, number>();
  const commenterCounts = new Map<string, number>();

  comments.forEach(comment => {
    const issueNumber = Number(comment.issue_url.split('/').pop());
    if (!Number.isFinite(issueNumber) || !issueNumbers.has(issueNumber)) {
      return;
    }

    commentCounts.set(issueNumber, (commentCounts.get(issueNumber) || 0) + 1);

    const login = comment.user?.login;
    if (login) {
      commenterCounts.set(login, (commenterCounts.get(login) || 0) + 1);
    }
  });

  const formattedIssues = issues.map(issue => formatIssue(issue, commentCounts.get(issue.number) || 0));
  const newIssues = formattedIssues.filter(issue => issue.createdAt >= windowStartIso);
  const closedIssues = formattedIssues.filter(issue => issue.closedAt !== null && issue.closedAt >= windowStartIso);
  const activeIssues = formattedIssues.filter(issue => issue.state === 'open');
  const unassignedActiveIssues = activeIssues.filter(issue => issue.assignees.length === 0);
  const mostDiscussedIssues = formattedIssues
    .filter(issue => issue.newComments > 0)
    .sort((a, b) => b.newComments - a.newComments || b.comments - a.comments || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);

  const topLabels = countBy(
    formattedIssues.flatMap(issue => issue.labels),
    label => label
  )
    .slice(0, limit)
    .map(({ key, count }) => ({ label: key, count }));

  const topCommenters = Array.from(commenterCounts.entries())
    .map(([login, count]) => ({ login, count }))
    .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login))
    .slice(0, limit);

  const sortByActivity = (left: EngagementIssue, right: EngagementIssue) =>
    right.newComments - left.newComments || right.updatedAt.localeCompare(left.updatedAt);

  return {
    metadata: {
      owner,
      repo,
      generatedAt: windowEnd.toISOString(),
      windowDays: days,
      windowStart: windowStartIso,
      windowEnd: windowEnd.toISOString()
    },
    metrics: {
      issuesTouched: formattedIssues.length,
      newIssues: newIssues.length,
      closedIssues: closedIssues.length,
      activeOpenIssues: activeIssues.length,
      unassignedActiveIssues: unassignedActiveIssues.length,
      newComments: comments.filter(comment => {
        const issueNumber = Number(comment.issue_url.split('/').pop());
        return Number.isFinite(issueNumber) && issueNumbers.has(issueNumber);
      }).length,
      uniqueCommenters: commenterCounts.size
    },
    topLabels,
    topCommenters,
    mostDiscussedIssues,
    newIssues: newIssues
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit),
    closedIssues: closedIssues
      .sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''))
      .slice(0, limit),
    activeIssues: activeIssues
      .sort(sortByActivity)
      .slice(0, limit),
    unassignedActiveIssues: unassignedActiveIssues
      .sort(sortByActivity)
      .slice(0, limit)
  };
}

function formatIssueList(issues: EngagementIssue[], emptyMessage: string): string {
  if (issues.length === 0) {
    return `${emptyMessage}\n`;
  }

  return issues.map(issue => {
    const labels = issue.labels.length > 0 ? ` | labels: ${issue.labels.join(', ')}` : '';
    const assignees = issue.assignees.length > 0 ? ` | assignees: ${issue.assignees.map(login => `@${login}`).join(', ')}` : ' | assignees: none';
    const comments = issue.newComments > 0 ? ` | new comments: ${issue.newComments}` : '';
    return `- [#${issue.number}](${issue.url}) ${issue.title} (${issue.state})${comments}${labels}${assignees}\n  - ${issue.excerpt}`;
  }).join('\n');
}

function formatMarkdown(summary: WeeklyEngagementSummary): string {
  const repoSlug = `${summary.metadata.owner}/${summary.metadata.repo}`;

  let markdown = `# Weekly Customer Engagement Summary\n\n`;
  markdown += `- **Repository:** ${repoSlug}\n`;
  markdown += `- **Window:** ${summary.metadata.windowStart} → ${summary.metadata.windowEnd}\n`;
  markdown += `- **Generated:** ${summary.metadata.generatedAt}\n\n`;

  markdown += `## Overview\n\n`;
  markdown += `- **Issues touched:** ${summary.metrics.issuesTouched}\n`;
  markdown += `- **New issues:** ${summary.metrics.newIssues}\n`;
  markdown += `- **Closed issues:** ${summary.metrics.closedIssues}\n`;
  markdown += `- **Active open issues:** ${summary.metrics.activeOpenIssues}\n`;
  markdown += `- **Unassigned active issues:** ${summary.metrics.unassignedActiveIssues}\n`;
  markdown += `- **New comments:** ${summary.metrics.newComments}\n`;
  markdown += `- **Unique commenters:** ${summary.metrics.uniqueCommenters}\n\n`;

  markdown += `## Most Discussed Issues\n\n${formatIssueList(summary.mostDiscussedIssues, 'No issue comments were added during this window.')}\n\n`;
  markdown += `## New Issues\n\n${formatIssueList(summary.newIssues, 'No new issues were opened during this window.')}\n\n`;
  markdown += `## Closed Issues\n\n${formatIssueList(summary.closedIssues, 'No issues were closed during this window.')}\n\n`;
  markdown += `## Active Open Issues\n\n${formatIssueList(summary.activeIssues, 'No open issues were updated during this window.')}\n\n`;
  markdown += `## Unassigned Active Issues\n\n${formatIssueList(summary.unassignedActiveIssues, 'No unassigned active issues need attention this week.')}\n\n`;

  markdown += `## Top Labels\n\n`;
  markdown += summary.topLabels.length > 0
    ? summary.topLabels.map(label => `- ${label.label}: ${label.count}`).join('\n')
    : 'No labels were applied to touched issues.';
  markdown += '\n\n';

  markdown += `## Top Commenters\n\n`;
  markdown += summary.topCommenters.length > 0
    ? summary.topCommenters.map(commenter => `- @${commenter.login}: ${commenter.count} comments`).join('\n')
    : 'No issue comments were added during this window.';
  markdown += '\n';

  return markdown;
}

function writeSummaryFiles(summary: WeeklyEngagementSummary, outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'weekly-engagement-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'weekly-engagement-summary.md'),
    formatMarkdown(summary)
  );
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is not set');
    console.error('   Set it with: export GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }

  const windowStart = new Date(Date.now() - argv.days * 24 * 60 * 60 * 1000).toISOString();

  console.log(`🗂️  Building weekly engagement summary for ${argv.owner}/${argv.repo}`);
  console.log(`   Window: last ${argv.days} days`);
  console.log(`   Output: ${argv.output}`);

  const [issues, comments] = await Promise.all([
    fetchRecentlyUpdatedIssues(argv.owner, argv.repo, windowStart, token),
    fetchRecentIssueComments(argv.owner, argv.repo, windowStart, token)
  ]);

  const summary = buildSummary(argv.owner, argv.repo, argv.days, issues, comments, argv.limit);
  writeSummaryFiles(summary, argv.output);

  console.log(`✅ Weekly summary written to ${argv.output}`);
}

main().catch(error => {
  console.error('❌ Summary generation failed:', error);
  process.exit(1);
});
