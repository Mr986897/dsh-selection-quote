#!/usr/bin/env node
/**
 * Build this plugin's own format-1 market index for GitHub Pages.
 *
 *   node scripts/build-index.mjs dist                  # commit = git HEAD
 *   node scripts/build-index.mjs dist --commit <sha>   # commit = a known release
 *
 * The index lists exactly this package: one plugin, one version taken from
 * package.json. Deploy `dist/` with GitHub Pages and add its index.json URL as
 * an index source in DSH (Plugins → Discover → Add index source).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const outDir = argv.find((item) => !item.startsWith('--')) ?? 'dist';
/** Read one flag; a function fallback runs lazily, so `--commit` works outside a git checkout. */
const flag = (name, fallback) => {
  const at = argv.indexOf('--' + name);
  if (at >= 0 && argv[at + 1] !== undefined) return argv[at + 1];
  return typeof fallback === 'function' ? fallback() : fallback;
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const commit = flag('commit', () => git('rev-parse', 'HEAD'));
if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error(`not a 40-hex commit: ${commit}`);

const remote = flag('repo', (() => {
  try {
    return git('remote', 'get-url', 'origin');
  } catch {
    return '';
  }
})());
const repoUrl = String(remote).replace(/^git@github\.com:/u, 'https://github.com/').replace(/\.git$/u, '');
if (!/^https:\/\/[^/]+\/.+\/.+/u.test(repoUrl)) {
  throw new Error('pass --repo https://github.com/<owner>/<repo> (no .git suffix)');
}
const owner = new URL(repoUrl).pathname.split('/').filter(Boolean)[0];

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const meta = (name) => JSON.parse(readFileSync(join('locale', name), 'utf8')).meta;
const en = meta('en.json');
const zh = meta('zh.json');
const icon = 'data:image/svg+xml;base64,' + readFileSync('icon.svg').toString('base64');

const index = {
  format: 1,
  title: { en: en.title + ' · plugin source', zh: zh.title + ' · 插件源' },
  description: {
    en: 'Self-hosted index for ' + pkg.name + '.',
    zh: pkg.name + ' 的自建插件源。',
  },
  plugins: [
    {
      name: pkg.name,
      title: { en: en.title, zh: zh.title },
      description: { en: en.description, zh: zh.description },
      author: owner,
      homepage: repoUrl + '#readme',
      repository: { url: repoUrl },
      icon,
      versions: [
        {
          version: pkg.version,
          publishTimestamp: Math.floor(Date.now() / 1000),
          source: { type: 'git', url: repoUrl, commit },
          engines: pkg.engines?.dsh === undefined ? {} : { dsh: pkg.engines.dsh },
        },
      ],
    },
  ],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${join(outDir, 'index.json')} for ${pkg.name}@${pkg.version} at ${commit}`);
