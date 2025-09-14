#!/usr/bin/env node

/**
 * CI Metrics Aggregation Script for CTRL FreaQ
 *
 * Collects and aggregates performance metrics from CI pipeline runs
 * Generates reports in JSON and human-readable formats
 * Designed to be called from GitHub Actions workflow
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');
const METRICS_DIR = join(REPO_ROOT, '.ci/metrics');

// Ensure metrics directory exists
if (!existsSync(METRICS_DIR)) {
    mkdirSync(METRICS_DIR, { recursive: true });
}

/**
 * Colors for console output
 */
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

/**
 * Log with colors
 */
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const color = {
        'info': colors.blue,
        'success': colors.green,
        'warning': colors.yellow,
        'error': colors.red
    }[level] || colors.reset;

    console.log(`${color}${level.toUpperCase()}${colors.reset} ${message}`);
    if (data) {
        console.log(`  ${JSON.stringify(data, null, 2)}`);
    }
}

/**
 * Get GitHub Actions context from environment
 */
function getGitHubContext() {
    return {
        workflow: process.env.GITHUB_WORKFLOW || 'Unknown',
        runNumber: process.env.GITHUB_RUN_NUMBER || '0',
        runId: process.env.GITHUB_RUN_ID || '0',
        ref: process.env.GITHUB_REF || 'unknown',
        sha: process.env.GITHUB_SHA || 'unknown',
        actor: process.env.GITHUB_ACTOR || 'unknown',
        eventName: process.env.GITHUB_EVENT_NAME || 'unknown',
        repository: process.env.GITHUB_REPOSITORY || 'unknown'
    };
}

/**
 * Get current Node.js and system information
 */
function getSystemInfo() {
    return {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) // GB
    };
}

/**
 * Get package information from monorepo
 */
function getPackageInfo() {
    try {
        const rootPackage = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
        const workspaceConfig = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');

        // Count workspace packages
        const packagePaths = [];
        const apps = readdirSync(join(REPO_ROOT, 'apps')).filter(name =>
            existsSync(join(REPO_ROOT, 'apps', name, 'package.json'))
        );
        const packages = readdirSync(join(REPO_ROOT, 'packages')).filter(name =>
            existsSync(join(REPO_ROOT, 'packages', name, 'package.json'))
        );

        return {
            name: rootPackage.name,
            version: rootPackage.version,
            workspaces: {
                apps: apps.length,
                packages: packages.length,
                total: apps.length + packages.length
            },
            engines: rootPackage.engines || {},
            packageManager: rootPackage.packageManager || 'unknown'
        };
    } catch (error) {
        log('warning', 'Could not read package information', error.message);
        return null;
    }
}

/**
 * Get file system metrics about the project
 */
function getFileSystemMetrics() {
    const metrics = {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        largestFiles: []
    };

    function scanDirectory(dirPath, relativePath = '') {
        try {
            const entries = readdirSync(dirPath);

            for (const entry of entries) {
                // Skip common ignore patterns
                if (['node_modules', '.git', 'dist', 'build', '.turbo', '.next'].includes(entry)) {
                    continue;
                }

                const fullPath = join(dirPath, entry);
                const stat = statSync(fullPath);
                const relativeFile = join(relativePath, entry);

                if (stat.isDirectory()) {
                    scanDirectory(fullPath, relativeFile);
                } else if (stat.isFile()) {
                    metrics.totalFiles++;
                    metrics.totalSize += stat.size;

                    // Track file type
                    const ext = entry.split('.').pop() || 'no-ext';
                    metrics.fileTypes[ext] = (metrics.fileTypes[ext] || 0) + 1;

                    // Track largest files
                    if (stat.size > 100 * 1024) { // Files > 100KB
                        metrics.largestFiles.push({
                            path: relativeFile,
                            size: stat.size,
                            sizeKB: Math.round(stat.size / 1024)
                        });
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }

    scanDirectory(REPO_ROOT);

    // Sort and limit largest files
    metrics.largestFiles.sort((a, b) => b.size - a.size);
    metrics.largestFiles = metrics.largestFiles.slice(0, 10);

    // Convert total size to human readable
    metrics.totalSizeMB = Math.round(metrics.totalSize / 1024 / 1024 * 100) / 100;

    return metrics;
}

/**
 * Parse workflow job results from GitHub environment
 */
function parseJobResults() {
    // These would typically come from GitHub Actions context
    // For now, we'll create a structure that can be filled by the workflow
    return {
        jobs: {
            setup: process.env.SETUP_RESULT || 'unknown',
            lint: process.env.LINT_RESULT || 'unknown',
            typecheck: process.env.TYPECHECK_RESULT || 'unknown',
            build: process.env.BUILD_RESULT || 'unknown',
            test: process.env.TEST_RESULT || 'unknown',
            'workspace-validation': process.env.WORKSPACE_RESULT || 'unknown'
        },
        timing: {
            setup: parseInt(process.env.SETUP_DURATION) || 0,
            lint: parseInt(process.env.LINT_DURATION) || 0,
            typecheck: parseInt(process.env.TYPECHECK_DURATION) || 0,
            build: parseInt(process.env.BUILD_DURATION) || 0,
            test: parseInt(process.env.TEST_DURATION) || 0,
            'workspace-validation': parseInt(process.env.WORKSPACE_DURATION) || 0
        }
    };
}

/**
 * Calculate performance score based on timing and success rate
 */
function calculatePerformanceScore(jobResults, fileSystemMetrics) {
    const { jobs, timing } = jobResults;
    const jobList = Object.keys(jobs);

    // Success rate (0-40 points)
    const successfulJobs = jobList.filter(job => jobs[job] === 'success').length;
    const successRate = successfulJobs / jobList.length;
    const successScore = Math.round(successRate * 40);

    // Speed score based on total duration (0-30 points)
    const totalDuration = Object.values(timing).reduce((sum, time) => sum + time, 0);
    const maxExpectedDuration = 5 * 60; // 5 minutes in seconds
    const speedScore = Math.max(0, Math.round(30 * (1 - totalDuration / maxExpectedDuration)));

    // Size efficiency (0-20 points)
    const reasonableProjectSize = 50; // MB
    const sizeEfficiency = Math.max(0, Math.min(20,
        Math.round(20 * (reasonableProjectSize / Math.max(fileSystemMetrics.totalSizeMB, reasonableProjectSize)))
    ));

    // File organization (0-10 points)
    const hasGoodStructure = fileSystemMetrics.fileTypes.ts > 10 &&
                           fileSystemMetrics.fileTypes.tsx > 5 &&
                           fileSystemMetrics.fileTypes.json > 5;
    const organizationScore = hasGoodStructure ? 10 : 5;

    const totalScore = successScore + speedScore + sizeEfficiency + organizationScore;

    return {
        total: totalScore,
        breakdown: {
            success: successScore,
            speed: speedScore,
            size: sizeEfficiency,
            organization: organizationScore
        },
        grade: totalScore >= 90 ? 'A' :
               totalScore >= 80 ? 'B' :
               totalScore >= 70 ? 'C' :
               totalScore >= 60 ? 'D' : 'F'
    };
}

/**
 * Generate comprehensive CI metrics
 */
function generateMetrics() {
    log('info', '🔍 Generating CI pipeline metrics...');

    const timestamp = new Date().toISOString();
    const github = getGitHubContext();
    const system = getSystemInfo();
    const packageInfo = getPackageInfo();
    const fileSystemMetrics = getFileSystemMetrics();
    const jobResults = parseJobResults();
    const performance = calculatePerformanceScore(jobResults, fileSystemMetrics);

    const metrics = {
        timestamp,
        version: '1.0.0',
        github,
        system,
        project: packageInfo,
        filesystem: fileSystemMetrics,
        jobs: jobResults,
        performance
    };

    log('success', 'Metrics collected successfully');

    return metrics;
}

/**
 * Generate human-readable report
 */
function generateHumanReport(metrics) {
    const lines = [];

    lines.push('CTRL FreaQ CI Pipeline Metrics Report');
    lines.push('=====================================');
    lines.push('');
    lines.push(`Generated: ${new Date(metrics.timestamp).toLocaleString()}`);
    lines.push(`Run: ${metrics.github.workflow} #${metrics.github.runNumber}`);
    lines.push(`Commit: ${metrics.github.sha.substring(0, 8)}`);
    lines.push(`Branch: ${metrics.github.ref.replace('refs/heads/', '')}`);
    lines.push('');

    // Project Overview
    lines.push('📦 Project Overview');
    lines.push('-------------------');
    if (metrics.project) {
        lines.push(`Name: ${metrics.project.name} v${metrics.project.version}`);
        lines.push(`Workspaces: ${metrics.project.workspaces.total} (${metrics.project.workspaces.apps} apps, ${metrics.project.workspaces.packages} packages)`);
        lines.push(`Package Manager: ${metrics.project.packageManager}`);
    }
    lines.push(`Files: ${metrics.filesystem.totalFiles.toLocaleString()}`);
    lines.push(`Size: ${metrics.filesystem.totalSizeMB} MB`);
    lines.push('');

    // Job Results
    lines.push('🚀 Job Results');
    lines.push('---------------');
    Object.entries(metrics.jobs.jobs).forEach(([job, result]) => {
        const duration = metrics.jobs.timing[job];
        const icon = result === 'success' ? '✅' : result === 'failure' ? '❌' : '⚠️';
        const durationStr = duration > 0 ? ` (${duration}s)` : '';
        lines.push(`${icon} ${job}: ${result}${durationStr}`);
    });
    lines.push('');

    // Performance Score
    lines.push('📊 Performance Score');
    lines.push('--------------------');
    lines.push(`Overall Grade: ${metrics.performance.grade} (${metrics.performance.total}/100)`);
    lines.push('');
    lines.push('Breakdown:');
    lines.push(`  Success Rate: ${metrics.performance.breakdown.success}/40`);
    lines.push(`  Speed: ${metrics.performance.breakdown.speed}/30`);
    lines.push(`  Size Efficiency: ${metrics.performance.breakdown.size}/20`);
    lines.push(`  Organization: ${metrics.performance.breakdown.organization}/10`);
    lines.push('');

    // File Type Distribution
    lines.push('📁 File Types (Top 10)');
    lines.push('----------------------');
    const sortedTypes = Object.entries(metrics.filesystem.fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

    sortedTypes.forEach(([ext, count]) => {
        lines.push(`  .${ext}: ${count} files`);
    });
    lines.push('');

    // Largest Files
    if (metrics.filesystem.largestFiles.length > 0) {
        lines.push('📄 Largest Files');
        lines.push('----------------');
        metrics.filesystem.largestFiles.slice(0, 5).forEach(file => {
            lines.push(`  ${file.path} (${file.sizeKB} KB)`);
        });
        lines.push('');
    }

    // System Info
    lines.push('💻 System Information');
    lines.push('---------------------');
    lines.push(`Node.js: ${metrics.system.nodeVersion}`);
    lines.push(`Platform: ${metrics.system.platform} ${metrics.system.arch}`);
    lines.push(`CPUs: ${metrics.system.cpus}`);
    lines.push(`Memory: ${metrics.system.memory} GB`);
    lines.push('');

    return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
    try {
        log('info', '🎯 Starting CI metrics generation...');

        const metrics = generateMetrics();

        // Write JSON metrics
        const jsonPath = join(METRICS_DIR, 'metrics.json');
        writeFileSync(jsonPath, JSON.stringify(metrics, null, 2));
        log('success', `JSON metrics written to: ${jsonPath}`);

        // Write human-readable report
        const reportPath = join(METRICS_DIR, 'report.txt');
        const report = generateHumanReport(metrics);
        writeFileSync(reportPath, report);
        log('success', `Human report written to: ${reportPath}`);

        // Write summary for GitHub Actions
        const summaryPath = join(METRICS_DIR, 'summary.md');
        const summaryLines = [
            '# CI Pipeline Metrics',
            '',
            `**Performance Grade:** ${metrics.performance.grade} (${metrics.performance.total}/100)`,
            '',
            '## Job Results',
            '',
            ...Object.entries(metrics.jobs.jobs).map(([job, result]) => {
                const duration = metrics.jobs.timing[job];
                const icon = result === 'success' ? '✅' : result === 'failure' ? '❌' : '⚠️';
                const durationStr = duration > 0 ? ` (${duration}s)` : '';
                return `- ${icon} **${job}**: ${result}${durationStr}`;
            }),
            '',
            '## Project Stats',
            '',
            `- **Files:** ${metrics.filesystem.totalFiles.toLocaleString()}`,
            `- **Size:** ${metrics.filesystem.totalSizeMB} MB`,
            metrics.project ? `- **Workspaces:** ${metrics.project.workspaces.total}` : '',
            '',
            `*Generated: ${new Date(metrics.timestamp).toLocaleString()}*`
        ].filter(Boolean);

        writeFileSync(summaryPath, summaryLines.join('\n'));
        log('success', `GitHub summary written to: ${summaryPath}`);

        log('success', '🎉 Metrics generation completed successfully!');

        // Return performance grade for exit code
        return metrics.performance.grade;

    } catch (error) {
        log('error', '💥 Failed to generate metrics', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const grade = main();

    // Exit with different codes based on performance
    const exitCode = {
        'A': 0,
        'B': 0,
        'C': 0,
        'D': 1,
        'F': 1
    }[grade] || 1;

    process.exit(exitCode);
}