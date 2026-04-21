// Strip the github plugin during --dry-run so local runs don't need a GITHUB_TOKEN
// (verifyConditions on @semantic-release/github fails without one, even in dry-run).
const isDryRun = process.argv.includes('--dry-run');

export default {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'build', release: 'patch' },
          { type: 'docs', release: 'patch' },
          { type: 'chore', release: 'patch' },
          { type: 'revert', release: 'patch' },
        ],
        parserOpts: { noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'] },
      },
    ],
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/bump-version.mjs ${nextRelease.version}',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'manifest.json', 'server/package.json', 'package-lock.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    ...(isDryRun
      ? []
      : [
          [
            '@semantic-release/github',
            {
              assets: [
                { path: '*.mcpb', label: 'MCP Bundle (${nextRelease.gitTag})' },
                {
                  path: 'example-mcp-dashbuilder.tgz',
                  label: 'Server tarball (${nextRelease.gitTag})',
                },
              ],
              successComment: false,
              failComment: false,
            },
          ],
        ]),
  ],
};
