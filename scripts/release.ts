#!/usr/bin/env bun
import { $ } from 'bun';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type Bump = 'patch' | 'minor' | 'major';
const bump = process.argv[2] as Bump;
const allowed: Bump[] = ['patch', 'minor', 'major'];

if (!allowed.includes(bump)) {
	console.error('Usage: bun run release -- <patch|minor|major>');
	process.exit(1);
}

const fileExists = async (path: string) => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

const dirty = (await $`git status --porcelain`.text()).trim();
if (dirty) {
	console.error('Working tree is dirty. Commit or stash changes before releasing.');
	process.exit(1);
}

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();

await $`bun run check`;
await $`bun run build`;

const pkgPath = 'package.json';
const pkg = JSON.parse(await Bun.file(pkgPath).text()) as { version: string };

const bumpVersion = (current: string, kind: Bump): string => {
	const parts = current.split('.').map(Number);
	if (parts.length !== 3 || parts.some(Number.isNaN)) {
		throw new Error(`Invalid version in package.json: ${current}`);
	}
	if (kind === 'patch') parts[2] += 1;
	if (kind === 'minor') {
		parts[1] += 1;
		parts[2] = 0;
	}
	if (kind === 'major') {
		parts[0] += 1;
		parts[1] = 0;
		parts[2] = 0;
	}
	return parts.join('.');
};

pkg.version = bumpVersion(pkg.version, bump);
await Bun.write(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');

const latestTag = (await $`git tag --list "v*" --sort=-v:refname`.text())
	.split('\n')
	.map((t) => t.trim())
	.filter(Boolean)[0];
const logRange = latestTag ? `${latestTag}..HEAD` : undefined;
const commitLog = logRange
	? await $`git log ${logRange} --pretty=format:%s`.text()
	: await $`git log --pretty=format:%s`.text();
const commitLines = commitLog
	.split('\n')
	.map((l) => l.trim())
	.filter(Boolean);
const commitBullets = commitLines.map((msg) => `- ${msg}`).join('\n') || '- No commits found.';

const tag = `v${pkg.version}`;
const date = new Date().toISOString().slice(0, 10);
const changelogPath = 'CHANGELOG.md';
const changelogHeader = '# Changelog';
const existingChangelog = (await fileExists(changelogPath))
	? await Bun.file(changelogPath).text()
	: `${changelogHeader}\n`;
const changelogEntry = `## ${tag} - ${date}\n${commitBullets}\n`;
const nextChangelog = `${existingChangelog.trim()}\n\n${changelogEntry}\n`;
await writeFile(changelogPath, nextChangelog);

await $`git add .`;
await $`git commit -m ${`chore: release ${tag}`}`;
await $`git tag ${tag}`;
await $`git push --tag`;
await $`npm publish --access public`;

const releaseNotes = `Changes in ${tag} (${date})\n\n${commitBullets}\n`;
const tmpNotes = join(tmpdir(), `trioxide-release-${Date.now()}.md`);
await writeFile(tmpNotes, releaseNotes);

try {
	await $`gh --version`;
	await $`gh release create ${tag} --notes-file ${tmpNotes}`;
} catch {
	console.warn('Skipped GitHub release (gh not available).');
}
