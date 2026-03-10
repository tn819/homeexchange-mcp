/**
 * Semantic release config — pre-1.0 versioning strategy:
 *   breaking change → minor bump  (0.1.0 → 0.2.0)
 *   feat            → minor bump  (0.1.0 → 0.1.1 → 0.2.0)
 *   fix / perf      → patch bump  (0.1.0 → 0.1.1)
 *
 * Bump to 1.0.0 manually when the project is stable and/or
 * an official HomeExchange partnership is in place.
 */

export default {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { breaking: true,  release: 'minor' },
          { type: 'feat',    release: 'minor' },
          { type: 'fix',     release: 'patch' },
          { type: 'perf',    release: 'patch' },
          { type: 'revert',  release: 'patch' },
        ],
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
        },
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat',     section: 'Features' },
            { type: 'fix',      section: 'Bug Fixes' },
            { type: 'perf',     section: 'Performance' },
            { type: 'revert',   section: 'Reverts' },
            { type: 'docs',     section: 'Documentation', hidden: false },
            { type: 'refactor', section: 'Code Refactoring', hidden: false },
            { type: 'chore',    hidden: true },
            { type: 'style',    hidden: true },
            { type: 'test',     hidden: true },
            { type: 'ci',       hidden: true },
          ],
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Changelog\n\nAll notable changes to homeexchange-mcp are documented here.',
      },
    ],
    ['@semantic-release/npm', { npmPublish: false }],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
};
