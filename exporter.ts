import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

interface ExportConfig {
  org: string;
  projectNumber: number;
  reposToAnalyze?: string[]; // ['repo1', 'repo2'] - optional specific repos
  daysBack?: number; // for PR/commit history, default 90
  token: string;
}

interface ProjectContext {
  projectMetadata: any;
  projectItems: any[];
  openPRs: PullRequestContext[];
  mergedPRsRecent: PullRequestContext[];
  openIssues: IssueContext[];
  recentCommits: CommitContext[];
  readmes: ReadmeContext[];
}

interface PullRequestContext {
  number: number;
  title: string;
  url: string;
  author: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  body: string;
  linkedIssues: { number: number; title: string }[];
  changedFiles: { filename: string; additions: number; deletions: number }[];
  comments: { author: string; body: string }[];
}

interface IssueContext {
  number: number;
  title: string;
  url: string;
  author: string;
  state: string;
  createdAt: string;
  labels: string[];
  assignees: string[];
  body: string;
  linkedPRs: { number: number; title: string }[];
}

interface CommitContext {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  filesChanged: number;
}

interface ReadmeContext {
  repo: string;
  content: string;
}

const GraphQLQuery = {
  projectItems: `
    query GetProjectBoardItems($org: String!, $projectNumber: Int!, $after: String) {
      organization(login: $org) {
        projectV2(number: $projectNumber) {
          id
          title
          description
          readme
          public
          closed
          createdAt
          updatedAt
          
          fields(first: 50) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                  description
                  color
                }
              }
            }
          }
          
          items(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              title
              body
              createdAt
              updatedAt
              isArchived
              
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  color
                }
              }
              
              priority: fieldValueByName(name: "Priority") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  color
                }
              }
              
              content {
                ... on Issue {
                  id
                  number
                  title
                  url
                  state
                  author {
                    login
                  }
                }
                ... on PullRequest {
                  id
                  number
                  title
                  url
                  state
                  author {
                    login
                  }
                }
                ... on DraftIssue {
                  id
                  title
                  body
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  `,

  pullRequests: `
    query GetPullRequests($org: String!, $repo: String!, $states: [PullRequestState!]!, $first: Int!) {
      repository(owner: $org, name: $repo) {
        pullRequests(first: $first, states: $states, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            number
            title
            body
            url
            state
            author {
              login
            }
            createdAt
            updatedAt
            mergedAt
            commits(last: 1) {
              nodes {
                commit {
                  oid
                }
              }
            }
            files(first: 100) {
              nodes {
                path
                additions
                deletions
              }
            }
            comments(first: 20) {
              nodes {
                author {
                  login
                }
                body
              }
            }
            closingIssuesReferences(first: 10) {
              nodes {
                number
                title
              }
            }
          }
        }
      }
    }
  `,

  issues: `
    query GetIssues($org: String!, $repo: String!, $states: [IssueState!]!, $first: Int!) {
      repository(owner: $org, name: $repo) {
        issues(first: $first, states: $states, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            number
            title
            body
            url
            state
            author {
              login
            }
            createdAt
            updatedAt
            labels(first: 20) {
              nodes {
                name
              }
            }
            assignees(first: 10) {
              nodes {
                login
              }
            }
            timelineItems(first: 50, itemTypes: [CONNECTED_EVENT]) {
              nodes {
                ... on ConnectedEvent {
                  subject {
                    ... on PullRequest {
                      number
                      title
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,

  commits: `
    query GetCommits($org: String!, $repo: String!, $branch: String!, $first: Int!) {
      repository(owner: $org, name: $repo) {
        ref(qualifiedName: $branch) {
          target {
            ... on Commit {
              history(first: $first) {
                nodes {
                  oid
                  message
                  author {
                    name
                    date
                  }
                  url
                  changedFilesIfAvailable
                }
              }
            }
          }
        }
      }
    }
  `
};

async function graphQLRequest(token: string, query: string, variables: any) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  });

  const result: any = await response.json();
  
  if (result.errors) {
    console.error('GraphQL Error:', result.errors);
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

async function fetchProjectItems(config: ExportConfig): Promise<any[]> {
  let allItems: any[] = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const data = await graphQLRequest(config.token, GraphQLQuery.projectItems, {
      org: config.org,
      projectNumber: config.projectNumber,
      after: endCursor
    });

    const items = data.organization.projectV2.items.nodes;
    allItems = allItems.concat(items);
    
    hasNextPage = data.organization.projectV2.items.pageInfo.hasNextPage;
    endCursor = data.organization.projectV2.items.pageInfo.endCursor;
  }

  return allItems;
}

async function fetchPullRequests(config: ExportConfig, repo: string, states: string[]): Promise<PullRequestContext[]> {
  const data = await graphQLRequest(config.token, GraphQLQuery.pullRequests, {
    org: config.org,
    repo: repo,
    states: states,
    first: 100
  });

  return data.repository.pullRequests.nodes.map((pr: any) => ({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author?.login,
    state: pr.state,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    mergedAt: pr.mergedAt,
    body: pr.body,
    linkedIssues: pr.closingIssuesReferences.nodes.map((issue: any) => ({
      number: issue.number,
      title: issue.title
    })),
    changedFiles: pr.files.nodes.map((file: any) => ({
      filename: file.path,
      additions: file.additions,
      deletions: file.deletions
    })),
    comments: pr.comments.nodes.map((comment: any) => ({
      author: comment.author?.login,
      body: comment.body
    }))
  }));
}

async function fetchIssues(config: ExportConfig, repo: string, states: string[]): Promise<IssueContext[]> {
  const data = await graphQLRequest(config.token, GraphQLQuery.issues, {
    org: config.org,
    repo: repo,
    states: states,
    first: 100
  });

  return data.repository.issues.nodes.map((issue: any) => ({
    number: issue.number,
    title: issue.title,
    url: issue.url,
    author: issue.author?.login,
    state: issue.state,
    createdAt: issue.createdAt,
    labels: issue.labels.nodes.map((label: any) => label.name),
    assignees: issue.assignees.nodes.map((assignee: any) => assignee.login),
    body: issue.body,
    linkedPRs: issue.timelineItems.nodes
      .map((item: any) => item.subject)
      .filter(Boolean)
      .map((pr: any) => ({
        number: pr.number,
        title: pr.title
      }))
  }));
}

async function fetchCommits(config: ExportConfig, repo: string, branch: string = 'main'): Promise<CommitContext[]> {
  try {
    const data = await graphQLRequest(config.token, GraphQLQuery.commits, {
      org: config.org,
      repo: repo,
      branch: branch,
      first: 50
    });

    return data.repository.ref.target.history.nodes.map((commit: any) => ({
      sha: commit.oid.substring(0, 7),
      message: commit.message,
      author: commit.author?.name,
      date: commit.author?.date,
      url: commit.url,
      filesChanged: commit.changedFilesIfAvailable || 0
    }));
  } catch (error) {
    console.warn(`Could not fetch commits for ${repo}:`, error);
    return [];
  }
}

async function fetchReadme(config: ExportConfig, repo: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.org}/${repo}/readme`,
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3.raw'
        }
      }
    );

    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.warn(`Could not fetch README for ${repo}`);
  }
  return null;
}

// Markdown formatters
function formatProjectItemsMarkdown(items: any[]): string {
  let md = '# Project Board Items\n\n';
  
  const itemsByStatus = new Map<string, any[]>();
  
  items.forEach(item => {
    const status = item.status?.name || 'No Status';
    if (!itemsByStatus.has(status)) {
      itemsByStatus.set(status, []);
    }
    itemsByStatus.get(status)!.push(item);
  });

  itemsByStatus.forEach((items, status) => {
    md += `\n## ${status}\n\n`;
    items.forEach(item => {
      md += `### ${item.title}\n`;
      md += `- **ID:** ${item.id}\n`;
      md += `- **Priority:** ${item.priority?.name || 'Not set'}\n`;
      md += `- **Created:** ${new Date(item.createdAt).toLocaleDateString()}\n`;
      if (item.body) {
        md += `- **Description:** ${item.body.substring(0, 200)}...\n`;
      }
      if (item.content) {
        if (item.content.__typename === 'Issue') {
          md += `- **Linked Issue:** [#${item.content.number}](${item.content.url})\n`;
        } else if (item.content.__typename === 'PullRequest') {
          md += `- **Linked PR:** [#${item.content.number}](${item.content.url})\n`;
        }
      }
      md += '\n';
    });
  });

  return md;
}

function formatPullRequestsMarkdown(prs: PullRequestContext[], title: string): string {
  let md = `# ${title}\n\n`;
  
  prs.forEach(pr => {
    md += `## [#${pr.number}](${pr.url}) - ${pr.title}\n`;
    md += `- **Author:** @${pr.author}\n`;
    md += `- **State:** ${pr.state}\n`;
    md += `- **Created:** ${new Date(pr.createdAt).toLocaleDateString()}\n`;
    if (pr.mergedAt) {
      md += `- **Merged:** ${new Date(pr.mergedAt).toLocaleDateString()}\n`;
    }
    md += `- **Files Changed:** ${pr.changedFiles.length}\n`;
    md += `- **Additions:** +${pr.changedFiles.reduce((sum, f) => sum + f.additions, 0)}\n`;
    md += `- **Deletions:** -${pr.changedFiles.reduce((sum, f) => sum + f.deletions, 0)}\n`;
    
    if (pr.linkedIssues.length > 0) {
      md += `- **Linked Issues:** ${pr.linkedIssues.map(i => `#${i.number}`).join(', ')}\n`;
    }
    
    if (pr.body) {
      md += `\n**Description:**\n${pr.body.substring(0, 300)}...\n`;
    }
    
    md += '\n---\n\n';
  });

  return md;
}

function formatIssuesMarkdown(issues: IssueContext[]): string {
  let md = '# Open Issues\n\n';
  
  issues.forEach(issue => {
    md += `## [#${issue.number}](${issue.url}) - ${issue.title}\n`;
    md += `- **Author:** @${issue.author}\n`;
    md += `- **State:** ${issue.state}\n`;
    md += `- **Created:** ${new Date(issue.createdAt).toLocaleDateString()}\n`;
    
    if (issue.assignees.length > 0) {
      md += `- **Assignees:** ${issue.assignees.map(a => `@${a}`).join(', ')}\n`;
    }
    
    if (issue.labels.length > 0) {
      md += `- **Labels:** ${issue.labels.join(', ')}\n`;
    }
    
    if (issue.linkedPRs.length > 0) {
      md += `- **Linked PRs:** ${issue.linkedPRs.map(pr => `#${pr.number}`).join(', ')}\n`;
    }
    
    md += '\n---\n\n';
  });

  return md;
}

function formatCommitsMarkdown(commits: CommitContext[]): string {
  let md = '# Recent Commits\n\n';
  
  commits.forEach(commit => {
    md += `- [${commit.sha}](${commit.url}) - ${commit.message}\n`;
    md += `  - **Author:** ${commit.author}\n`;
    md += `  - **Date:** ${new Date(commit.date).toLocaleDateString()}\n`;
    md += `  - **Files:** ${commit.filesChanged}\n\n`;
  });

  return md;
}

// Main export function
async function exportProjectContext(config: ExportConfig): Promise<ProjectContext> {
  console.log(`📊 Exporting project context for ${config.org}/projects/${config.projectNumber}...`);

  // Fetch project items
  console.log('  📋 Fetching project items...');
  const projectItems = await fetchProjectItems(config);

  // Determine repos to analyze
  const reposToAnalyze = config.reposToAnalyze || ['iTwin-core', 'iTwin-web-viewer'];
  
  const openPRs: PullRequestContext[] = [];
  const mergedPRsRecent: PullRequestContext[] = [];
  const openIssues: IssueContext[] = [];
  const recentCommits: CommitContext[] = [];
  const readmes: ReadmeContext[] = [];

  for (const repo of reposToAnalyze) {
    console.log(`  🔍 Analyzing repo: ${repo}`);
    
    // Fetch PRs
    const open = await fetchPullRequests(config, repo, ['OPEN']);
    const merged = await fetchPullRequests(config, repo, ['MERGED']);
    
    openPRs.push(...open);
    mergedPRsRecent.push(...merged.filter(pr => {
      const daysOld = (Date.now() - new Date(pr.mergedAt!).getTime()) / (1000 * 60 * 60 * 24);
      return daysOld <= (config.daysBack || 90);
    }));

    // Fetch issues
    const issues = await fetchIssues(config, repo, ['OPEN']);
    openIssues.push(...issues);

    // Fetch commits
    const commits = await fetchCommits(config, repo);
    recentCommits.push(...commits);

    // Fetch README
    const readme = await fetchReadme(config, repo);
    if (readme) {
      readmes.push({ repo, content: readme });
    }
  }

  return {
    projectMetadata: {
      org: config.org,
      projectNumber: config.projectNumber,
      exportedAt: new Date().toISOString()
    },
    projectItems,
    openPRs,
    mergedPRsRecent,
    openIssues,
    recentCommits,
    readmes
  };
}

// Export to files
async function exportToFiles(context: ProjectContext, outputDir: string = './exports'): Promise<void> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON export
  fs.writeFileSync(
    path.join(outputDir, 'project-context.json'),
    JSON.stringify(context, null, 2)
  );
  console.log('✅ Exported project-context.json');

  // Markdown exports
  fs.writeFileSync(
    path.join(outputDir, 'project-items.md'),
    formatProjectItemsMarkdown(context.projectItems)
  );
  console.log('✅ Exported project-items.md');

  fs.writeFileSync(
    path.join(outputDir, 'open-prs.md'),
    formatPullRequestsMarkdown(context.openPRs, 'Open Pull Requests')
  );
  console.log('✅ Exported open-prs.md');

  fs.writeFileSync(
    path.join(outputDir, 'merged-prs-recent.md'),
    formatPullRequestsMarkdown(context.mergedPRsRecent, 'Recently Merged PRs (Last 90 Days)')
  );
  console.log('✅ Exported merged-prs-recent.md');

  fs.writeFileSync(
    path.join(outputDir, 'open-issues.md'),
    formatIssuesMarkdown(context.openIssues)
  );
  console.log('✅ Exported open-issues.md');

  fs.writeFileSync(
    path.join(outputDir, 'recent-commits.md'),
    formatCommitsMarkdown(context.recentCommits)
  );
  console.log('✅ Exported recent-commits.md');

  // README exports
  context.readmes.forEach(readme => {
    fs.writeFileSync(
      path.join(outputDir, `README-${readme.repo}.md`),
      readme.content
    );
  });
  console.log(`✅ Exported ${context.readmes.length} READMEs`);
}

// CLI usage
const config: ExportConfig = {
  org: 'iTwin',
  projectNumber: 145,
  reposToAnalyze: [
    'iTwin-core',
    'iTwin-web-viewer',
    // Add more repos as needed
  ],
  daysBack: 90,
  token: process.env.GITHUB_TOKEN!
};

exportProjectContext(config)
  .then(context => exportToFiles(context))
  .then(() => console.log('\n🎉 Export complete!'))
  .catch(error => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });

export { exportProjectContext, exportToFiles, ProjectContext };
