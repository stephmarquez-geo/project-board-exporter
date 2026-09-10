#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { exportProjectContext, exportToFiles } from './exporter';
import * as fs from 'fs';

interface CLIArgs {
  org: string;
  project: number;
  repos?: string;
  daysBack?: number;
  output?: string;
  filter?: string;
  _: string[];
  $0: string;
}

const argv = yargs(hideBin(process.argv))
  .option('org', {
    alias: 'o',
    description: 'GitHub organization name',
    type: 'string',
    default: 'iTwin'
  })
  .option('project', {
    alias: 'p',
    description: 'Project board number (e.g., 145)',
    type: 'number',
    required: true
  })
  .option('repos', {
    alias: 'r',
    description: 'Comma-separated list of repositories to analyze',
    type: 'string',
    default: 'iTwin-core,iTwin-web-viewer'
  })
  .option('daysBack', {
    alias: 'd',
    description: 'Number of days back to analyze merged PRs and commits',
    type: 'number',
    default: 90
  })
  .option('output', {
    alias: 'out',
    description: 'Output directory for exports',
    type: 'string',
    default: './exports'
  })
  .option('filter', {
    alias: 'f',
    description: 'Filter project items by labels (comma-separated)',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .parseSync() as unknown as CLIArgs;

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is not set');
    console.error('   Set it with: export GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }

  console.log('🚀 Starting Project Board Export\n');
  console.log(`   Organization: ${argv.org}`);
  console.log(`   Project: ${argv.project}`);
  console.log(`   Repositories: ${argv.repos}`);
  console.log(`   Days Back: ${argv.daysBack}`);
  console.log(`   Output Dir: ${argv.output}\n`);

  try {
    const reposArray = argv.repos.split(',').map(r => r.trim());

    const context = await exportProjectContext({
      org: argv.org,
      projectNumber: argv.project,
      reposToAnalyze: reposArray,
      daysBack: argv.daysBack,
      token
    });

    console.log('\n📦 Export Results:');
    console.log(`   Total Project Items: ${context.projectItems.length}`);
    console.log(`   Open PRs: ${context.openPRs.length}`);
    console.log(`   Merged PRs (last ${argv.daysBack} days): ${context.mergedPRsRecent.length}`);
    console.log(`   Open Issues: ${context.openIssues.length}`);
    console.log(`   Recent Commits: ${context.recentCommits.length}`);
    console.log(`   READMEs: ${context.readmes.length}\n`);

    await exportToFiles(context, argv.output);

    console.log(`✅ Export complete! Files saved to: ${argv.output}\n`);
    
    console.log('📄 Generated Files:');
    const files = fs.readdirSync(argv.output);
    files.forEach(file => {
      const filePath = `${argv.output}/${file}`;
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   - ${file} (${sizeKB} KB)`);
    });
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Review the JSON export for programmatic access');
    console.log('   2. Share Markdown files with your team');
    console.log('   3. Use JSON to feed into analysis tools or dashboards');

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

main();
