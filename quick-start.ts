#!/usr/bin/env node

import * as fs from 'fs';
import { generateAdvancedAnalysis } from './advanced-exporter';
import { exportProjectContext, exportToFiles } from './exporter';

interface QuickStartConfig {
  org: string;
  projectNumber: number;
  repos: string[];
  outputDir: string;
  includeAnalysis: boolean;
  daysBack: number;
}

export async function exportiTwinProject145(token: string): Promise<void> {
  console.log('\n=== iTwin Project 145 Export ===\n');

  const config: QuickStartConfig = {
    org: 'iTwin',
    projectNumber: 145,
    repos: ['iTwin-core', 'iTwin-web-viewer'],
    outputDir: './exports/iTwin-145',
    includeAnalysis: true,
    daysBack: 90
  };

  try {
    console.log('📊 Fetching project context...');
    const context = await exportProjectContext({
      org: config.org,
      projectNumber: config.projectNumber,
      reposToAnalyze: config.repos,
      daysBack: config.daysBack,
      token
    });

    console.log('\n📦 Summary:');
    console.log(`   Project Items: ${context.projectItems.length}`);
    console.log(`   Open PRs: ${context.openPRs.length}`);
    console.log(`   Merged (${config.daysBack}d): ${context.mergedPRsRecent.length}`);
    console.log(`   Open Issues: ${context.openIssues.length}`);
    console.log(`   Recent Commits: ${context.recentCommits.length}`);
    console.log(`   READMEs: ${context.readmes.length}\n`);

    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }

    console.log('💾 Writing exports...');
    await exportToFiles(context, config.outputDir);

    if (config.includeAnalysis) {
      console.log('🔍 Generating advanced analysis...');
      await generateAdvancedAnalysis(context, config.outputDir);
    }

    console.log('\n✅ Export complete!');
    console.log(`📂 Files saved to: ${config.outputDir}`);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

export async function exportMultipleProjects(token: string, projectNumbers: number[]): Promise<void> {
  const org = 'iTwin';
  const baseOutputDir = './exports/iTwin-multi';

  if (!fs.existsSync(baseOutputDir)) {
    fs.mkdirSync(baseOutputDir, { recursive: true });
  }

  for (const projectNumber of projectNumbers) {
    console.log(`\n📊 Exporting Project ${projectNumber}...`);

    const context = await exportProjectContext({
      org,
      projectNumber,
      reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],
      daysBack: 90,
      token
    });

    const projectDir = `${baseOutputDir}/project-${projectNumber}`;
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    await exportToFiles(context, projectDir);
    await generateAdvancedAnalysis(context, projectDir);
  }

  console.log('\n✅ Multi-project export complete!');
}

export async function analyzeByTheme(token: string, theme: string): Promise<void> {
  const context = await exportProjectContext({
    org: 'iTwin',
    projectNumber: 145,
    reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],
    daysBack: 90,
    token
  });

  const themeKeywords: Record<string, string[]> = {
    aec: ['AEC', 'architecture', 'engineering', 'construction', 'BIM'],
    filtering: ['filter', 'query', 'search', 'metadata', 'readable'],
    georeferencing: ['geo', 'coordinate', 'transform', 'location'],
    '3dTiles': ['3d tiles', '3dtiles', 'tileset', 'glTF'],
    realityCapture: ['reality', 'capture', 'photogrammetry', 'mesh', 'point cloud'],
    cesium: ['cesium', 'ion', 'cartographic'],
    designReview: ['design review', 'markup', 'annotation']
  };

  const keywords = themeKeywords[theme.toLowerCase()] || [];

  console.log(`\n🎯 Analyzing ${theme} theme...`);
  console.log(`Keywords: ${keywords.join(', ')}\n`);

  const relatedPRs = [...context.openPRs, ...context.mergedPRsRecent].filter(pr => {
    const text = `${pr.title} ${pr.body}`.toLowerCase();
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  });

  const relatedIssues = context.openIssues.filter(issue => {
    const text = `${issue.title} ${issue.body}`.toLowerCase();
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  });

  console.log('Found:');
  console.log(`  - ${relatedPRs.length} related PRs`);
  console.log(`  - ${relatedIssues.length} related issues\n`);
}

if (process.argv[1] && process.argv[1].endsWith('quick-start.js')) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN not set. Export it with:');
    console.error('   export GITHUB_TOKEN=ghp_your_token_here');
    process.exit(1);
  }

  exportiTwinProject145(token);
}
