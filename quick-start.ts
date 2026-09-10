#!/usr/bin/env node

/**
 * Quick Start Guide for project-board-exporter
 * 
 * This tool extracts comprehensive context from GitHub Projects v2,
 * including PRs, issues, commits, and activity analysis.
 * 
 * Perfect for feeding AI agents, status reporting, and risk identification.
 */

import { exportProjectContext, exportToFiles } from './exporter';
import { generateAdvancedAnalysis } from './advanced-exporter';
import * as fs from 'fs';

interface QuickStartConfig {
  org: string;
  projectNumber: number;
  repos: string[];
  outputDir?: string;
  includeAnalysis?: boolean;
  daysBack?: number;
}

/**
 * Example: Export iTwin Project 145 with full analysis
 */
export async function exportiTwinProject145(token: string) {
  console.log('\n=== iTwin Project 145 Export ===\n');
  
  const config: QuickStartConfig = {
    org: 'iTwin',
    projectNumber: 145,
    repos: [
      'iTwin-core',
      'iTwin-web-viewer',
      // Add more repos as needed based on your analysis
    ],
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
      daysBack: config.daysBack || 90,
      token
    });

    console.log(`\n📦 Summary:`);
    console.log(`   Project Items: ${context.projectItems.length}`);\n    console.log(`   Open PRs: ${context.openPRs.length}`);\n    console.log(`   Merged (90d): ${context.mergedPRsRecent.length}`);\n    console.log(`   Open Issues: ${context.openIssues.length}`);\n    console.log(`   Recent Commits: ${context.recentCommits.length}`);\n    console.log(`   READMEs: ${context.readmes.length}\n`);\n\n    // Ensure output directory exists\n    if (!fs.existsSync(config.outputDir!)) {\n      fs.mkdirSync(config.outputDir!, { recursive: true });\n    }\n\n    // Export to files\n    console.log('💾 Writing exports...');\n    await exportToFiles(context, config.outputDir);\n\n    // Generate analysis\n    if (config.includeAnalysis) {\n      console.log('🔍 Generating advanced analysis...');\n      await generateAdvancedAnalysis(context, config.outputDir);\n    }\n\n    console.log(`\\n✅ Export complete!`);\n    console.log(`📂 Files saved to: ${config.outputDir}`);\n    console.log(`\n📄 Generated files:`);\n    const files = fs.readdirSync(config.outputDir!);\n    files.forEach(file => {\n      const stats = fs.statSync(`${config.outputDir}/${file}`);\n      const sizeKB = (stats.size / 1024).toFixed(2);\n      console.log(`   - ${file} (${sizeKB} KB)`);\n    });\n\n    console.log(`\n🎯 Next Steps:`);\n    console.log(`   1. Review project-context.json for raw data`);\n    console.log(`   2. Check analysis-report.md for themes & risks`);\n    console.log(`   3. Review open-prs.md and merged-prs-recent.md for activity`);\n    console.log(`   4. Feed JSON to AI agents or dashboards`);\n\n  } catch (error) {\n    console.error('❌ Export failed:', error);\n    process.exit(1);\n  }\n}\n\n/**\n * Example: Multi-project export for cross-project analysis\n */\nexport async function exportMultipleProjects(token: string, projectNumbers: number[]) {\n  const org = 'iTwin';\n  const baseOutputDir = './exports/iTwin-multi';\n\n  if (!fs.existsSync(baseOutputDir)) {\n    fs.mkdirSync(baseOutputDir, { recursive: true });\n  }\n\n  for (const projectNumber of projectNumbers) {\n    console.log(`\\n📊 Exporting Project ${projectNumber}...`);\n    \n    const context = await exportProjectContext({\n      org,\n      projectNumber,\n      reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],\n      daysBack: 90,\n      token\n    });\n\n    const projectDir = `${baseOutputDir}/project-${projectNumber}`;\n    if (!fs.existsSync(projectDir)) {\n      fs.mkdirSync(projectDir, { recursive: true });\n    }\n\n    await exportToFiles(context, projectDir);\n    await generateAdvancedAnalysis(context, projectDir);\n  }\n\n  console.log(`\\n✅ Multi-project export complete!`);\n}\n\n/**\n * Example: Filter and analyze by theme\n */\nexport async function analyzeByTheme(token: string, theme: string) {\n  const context = await exportProjectContext({\n    org: 'iTwin',\n    projectNumber: 145,\n    reposToAnalyze: ['iTwin-core', 'iTwin-web-viewer'],\n    daysBack: 90,\n    token\n  });\n\n  const themeKeywords: Record<string, string[]> = {\n    aec: ['AEC', 'architecture', 'engineering', 'construction', 'BIM'],\n    filtering: ['filter', 'query', 'search', 'metadata', 'readable'],\n    georeferencing: ['geo', 'coordinate', 'transform', 'location'],\n    '3dTiles': ['3d tiles', '3dtiles', 'tileset', 'glTF'],\n    realityCapture: ['reality', 'capture', 'photogrammetry', 'mesh', 'point cloud'],\n    cesium: ['cesium', 'ion', 'cartographic'],\n    designReview: ['design review', 'markup', 'annotation']\n  };\n\n  const keywords = themeKeywords[theme.toLowerCase()] || [];\n  \n  console.log(`\\n🎯 Analyzing ${theme} theme...`);\n  console.log(`Keywords: ${keywords.join(', ')}\\n`);\n\n  // Filter PRs by theme\n  const relatedPRs = [\n    ...context.openPRs,\n    ...context.mergedPRsRecent\n  ].filter(pr => {\n    const text = `${pr.title} ${pr.body}`.toLowerCase();\n    return keywords.some(kw => text.includes(kw.toLowerCase()));\n  });\n\n  // Filter issues by theme\n  const relatedIssues = context.openIssues.filter(issue => {\n    const text = `${issue.title} ${issue.body}`.toLowerCase();\n    return keywords.some(kw => text.includes(kw.toLowerCase()));\n  });\n\n  console.log(`Found:`);\n  console.log(`  - ${relatedPRs.length} related PRs`);\n  console.log(`  - ${relatedIssues.length} related issues\\n`);\n\n  console.log(`📌 Related PRs:`);\n  relatedPRs.slice(0, 10).forEach(pr => {\n    console.log(`   #${pr.number}: ${pr.title}`);\n  });\n\n  console.log(`\\n📌 Related Issues:`);\n  relatedIssues.slice(0, 10).forEach(issue => {\n    console.log(`   #${issue.number}: ${issue.title}`);\n  });\n}\n\n// Main\nif (require.main === module) {\n  const token = process.env.GITHUB_TOKEN;\n  if (!token) {\n    console.error('❌ GITHUB_TOKEN not set. Export it with:');\n    console.error('   export GITHUB_TOKEN=ghp_your_token_here');\n    process.exit(1);\n  }\n\n  // Run export\n  exportiTwinProject145(token);\n}\n\nexport { QuickStartConfig };\n