#!/usr/bin/env node
/**
 * Bump the patch version of this package (1.0.0 → 1.0.1, 1.2.3-beta.1 → 1.2.4).
 * Used by the release workflow: every push that touches bundle files becomes a
 * new market version, so nobody bumps it by hand.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major = 0, minor = 0, patch = 0] = pkg.version.split('-')[0].split('.').map(Number);
pkg.version = `${major}.${minor}.${patch + 1}`;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`version -> ${pkg.version}`);
