#!/usr/bin/env node
// nawy-dev-flow: one private copy of every repo per piece of work, on its own branch and ports, so parallel
// Claude sessions never switch each other's branches. Settings: dev-flow.json in the workspace (this script's
// folder's parent). /dev-setup copies this file into <workspace>/scripts/; Mac or Linux, Node 18+, no packages.
//
//   node scripts/dev-flow.mjs start <folder> <branch>  make or reuse .worktrees/<folder>-<repo> on <branch>
//                                                    (a new branch starts from the latest origin/<base>)
//   node scripts/dev-flow.mjs end <folder>             remove them; refuses with unsaved or unpushed work; the branch stays
//   node scripts/dev-flow.mjs uat-start <name>         read-only copies .worktrees/uat-<name>-<repo> at the latest UAT branch
//   node scripts/dev-flow.mjs uat-end <name>           remove them; refuses if any file in them changed
//   node scripts/dev-flow.mjs list                     every copy, its branch, ports and state
//   node scripts/dev-flow.mjs tunnels                  (re)start the SSH tunnels in dev-flow.json
//   node scripts/dev-flow.mjs doctor                   check tools, clones, .env files and tunnels
//   node scripts/dev-flow.mjs sql "<query>"            read data for a UAT check (dev-flow.json "db", main clone's .env)
import {execFileSync, spawn} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, 'dev-flow.json');
const WT = join(ROOT, '.worktrees');
const LAUNCH = join(ROOT, '.claude', 'launch.json');

function die(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}
if (!existsSync(CONFIG)) die(`no dev-flow.json in ${ROOT} — run /dev-setup first`);
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const branches = {base: 'main', uat: 'staging', ...cfg.branches};

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts}).trim();
const git = (dir, ...args) => sh('git', ['-C', dir, ...args]);
const tryGit = (dir, ...args) => {
	try {
		return git(dir, ...args);
	} catch {
		return null;
	}
};
// Only ever the local listener: connecting through a tunnel to "check" it counts as a failed database login.
const listening = (port) => {
	try {
		sh('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
		return true;
	} catch {
		return false;
	}
};
const clone = (repo) => join(ROOT, repo.clone);
const copy = (folder, repo) => join(WT, `${folder}-${repo.name}`);
const portsFile = (folder) => join(WT, `${folder}.ports.json`);
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const kebab = (s, what) => /^[a-z0-9][a-z0-9-]*$/.test(s) || die(`${what} must be kebab-case, e.g. new-filters`);

function parseEnv(file) {
	const env = {};
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return env;
}

function setEnv(file, key, value) {
	const lines = readFileSync(file, 'utf8').split('\n');
	const i = lines.findIndex((l) => l.startsWith(`${key}=`));
	if (i >= 0) lines[i] = `${key}=${value}`;
	else lines.splice(lines.at(-1) === '' ? -1 : lines.length, 0, `${key}=${value}`);
	writeFileSync(file, lines.join('\n'));
}

// "{port}" is this repo's port, "{port:backend}" another repo's.
const fill = (template, ports, own) => template.replace(/\{port(?::([\w-]+))?\}/g, (_, name) => ports[name ?? own]);

function tunnels() {
	for (const t of cfg.tunnels ?? []) {
		if (listening(t.port)) {
			console.log(`  tunnel ${t.port} (${t.name}): up`);
			continue;
		}
		spawn('ssh', ['-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-N', t.via, '-L', `${t.port}:${t.to}`], {detached: true, stdio: 'ignore'}).unref();
		let up = false;
		for (let i = 0; i < 15 && !up; i++) {
			sh('sleep', ['1']);
			up = listening(t.port);
		}
		console.log(`  tunnel ${t.port} (${t.name}): ${up ? 'started' : 'FAILED — check the network, VPN or SSH key (/dev-setup, Tunnels)'}`);
	}
}

// The first n where every repo's port+n is free and no other copy claims it.
function freePorts() {
	const claimed = new Set(readdirSync(WT).filter((f) => f.endsWith('.ports.json')).flatMap((f) => Object.values(readJson(join(WT, f), {}))));
	for (let n = 1; n < 20; n++) {
		const ports = Object.fromEntries(cfg.repos.filter((r) => r.port).map((r) => [r.name, r.port + n]));
		if (Object.values(ports).every((p) => !listening(p) && !claimed.has(p))) return ports;
	}
	die('no free set of ports (tried +1 to +19) — end a copy you no longer use');
}

function launchEntries(folder, ports) {
	const data = readJson(LAUNCH, {version: '0.0.1', configurations: []});
	data.configurations = data.configurations.filter((c) => !cfg.repos.some((r) => c.name === `${folder}-${r.name}`));
	for (const r of ports ? cfg.repos.filter((r) => r.preview && r.start) : []) {
		data.configurations.push({
			name: `${folder}-${r.name}`,
			runtimeExecutable: 'sh',
			runtimeArgs: ['-c', `cd .worktrees/${folder}-${r.name} && ${fill(r.start, ports, r.name)}`],
			port: ports[r.name],
		});
	}
	mkdirSync(dirname(LAUNCH), {recursive: true});
	writeFileSync(LAUNCH, JSON.stringify(data, null, 2) + '\n');
}

function addCopy(folder, repo, branch) {
	const wt = copy(folder, repo);
	const c = clone(repo);
	if (existsSync(wt)) {
		const on = git(wt, 'branch', '--show-current');
		if (on !== branch) die(`.worktrees/${folder}-${repo.name} is on ${on}, not ${branch} — pick another folder name`);
		return console.log(`  ${repo.name}: .worktrees/${folder}-${repo.name} already on ${branch}`);
	}
	git(c, 'fetch', '-q', 'origin');
	let how;
	if (tryGit(c, 'show-ref', '-q', '--verify', `refs/heads/${branch}`) !== null) {
		if (tryGit(c, 'worktree', 'add', '-q', wt, branch) === null) die(`${branch} is open in another folder of ${repo.name} (git -C ${c} worktree list) — end that one first`);
		how = 'existing branch';
	} else if (tryGit(c, 'show-ref', '-q', '--verify', `refs/remotes/origin/${branch}`) !== null) {
		git(c, 'worktree', 'add', '-q', '--track', '-b', branch, wt, `origin/${branch}`);
		how = 'branch from GitHub';
	} else {
		git(c, 'worktree', 'add', '-q', '--no-track', '-b', branch, wt, `origin/${branches.base}`);
		how = `new branch from the latest ${branches.base}`;
	}
	console.log(`  ${repo.name}: .worktrees/${folder}-${repo.name} — ${how}`);
}

function start(folder, branch) {
	kebab(folder, 'folder');
	if (folder.startsWith('uat-')) die('folders named uat-… are the read-only UAT copies — pick another name');
	if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)) die(`not a valid branch name: ${branch}`);
	mkdirSync(WT, {recursive: true});
	for (const r of cfg.repos) addCopy(folder, r, branch);

	let ports = readJson(portsFile(folder), null);
	if (!ports) {
		ports = freePorts();
		for (const r of cfg.repos) {
			const envName = r.envFile ?? '.env';
			const from = join(clone(r), envName);
			const to = join(copy(folder, r), envName);
			if (!existsSync(from)) {
				console.log(`  ${r.name}: no ${envName} in ${r.clone} — ask your tech lead for it, then /dev-start again`);
				continue;
			}
			copyFileSync(from, to);
			for (const [key, template] of Object.entries(r.env ?? {})) setEnv(to, key, fill(template, ports, r.name));
		}
		writeFileSync(portsFile(folder), JSON.stringify(ports, null, 2) + '\n');
	}
	for (const r of cfg.repos) {
		// ponytail: a full install per copy (minutes, disk); sharing the main clone's node_modules needs per-tool cache fixes
		if (r.install && !existsSync(join(copy(folder, r), 'node_modules'))) {
			console.log(`  ${r.name}: installing (${r.install}) …`);
			execFileSync('sh', ['-c', r.install], {cwd: copy(folder, r), stdio: ['ignore', 'ignore', 'inherit']});
		}
	}
	launchEntries(folder, ports);
	tunnels();
	for (const r of cfg.repos.filter((r) => r.start)) {
		const where = r.preview ? `preview button "${folder}-${r.name}"` : `cd .worktrees/${folder}-${r.name} && ${fill(r.start, ports, r.name)}`;
		console.log(`  ${r.name}: http://localhost:${ports[r.name]} — ${where}`);
	}
	console.log(`✓ ready: ${branch} in ${cfg.repos.map((r) => `.worktrees/${folder}-${r.name}`).join(', ')}`);
}

// Stops every process running inside a copy (dev servers, watchers).
function stopProcesses(dir) {
	let out = '';
	try {
		out = sh('lsof', ['-a', '-d', 'cwd', '-Fpn']);
	} catch (e) {
		out = e.stdout ?? '';
	}
	let pid;
	for (const line of out.split('\n')) {
		if (line[0] === 'p') pid = Number(line.slice(1));
		else if (line[0] === 'n' && line.slice(1).startsWith(dir) && pid !== process.pid) {
			try {
				process.kill(pid);
			} catch {}
		}
	}
}

function end(folder) {
	if (folder.startsWith('uat-')) die(`UAT copies end with: node scripts/dev-flow.mjs uat-end ${folder.slice(4)}`);
	const present = cfg.repos.filter((r) => existsSync(copy(folder, r)));
	if (!present.length) die(`no copies named ${folder}`);
	for (const r of present) {
		// check them all before touching any
		const wt = copy(folder, r);
		if (git(wt, 'status', '--porcelain')) die(`${r.name} has unsaved changes — commit them first`);
		const branch = git(wt, 'branch', '--show-current');
		git(wt, 'fetch', '-q', 'origin');
		const base = tryGit(wt, 'rev-parse', '-q', '--verify', `origin/${branch}`) ? `origin/${branch}` : `origin/${branches.base}`;
		const ahead = Number(git(wt, 'rev-list', '--count', `${base}..HEAD`));
		if (ahead) die(`${r.name} has ${ahead} commit(s) not on GitHub — push first`);
	}
	for (const r of present) {
		const wt = copy(folder, r);
		const branch = git(wt, 'branch', '--show-current');
		stopProcesses(wt);
		git(clone(r), 'worktree', 'remove', '--force', wt); // --force: untracked .env and node_modules only, checked clean above
		console.log(`  ${r.name}: .worktrees/${folder}-${r.name} removed, branch ${branch} kept`);
	}
	rmSync(portsFile(folder), {force: true});
	launchEntries(folder, null);
	console.log(`✓ ended ${folder}`);
}

// UAT tests the deployed environment in the browser; these copies are only for reading its code. Detached from any
// branch, so there is nothing to commit or push; .claude/settings.json (written by /dev-setup) blocks edits in them.
function uatStart(name) {
	kebab(name, 'name');
	mkdirSync(WT, {recursive: true});
	for (const r of cfg.repos) {
		const wt = copy(`uat-${name}`, r);
		git(clone(r), 'fetch', '-q', 'origin', branches.uat);
		if (existsSync(wt)) {
			if (git(wt, 'status', '--porcelain')) die(`${r.name} UAT copy has changed files — UAT never changes code (git -C ${wt} status)`);
			git(wt, 'checkout', '-q', '--detach', `origin/${branches.uat}`);
		} else {
			git(clone(r), 'worktree', 'add', '-q', '--detach', wt, `origin/${branches.uat}`);
		}
		console.log(`  ${r.name}: .worktrees/uat-${name}-${r.name} — ${branches.uat} @ ${git(wt, 'rev-parse', '--short', 'HEAD')}`);
	}
	tunnels();
	console.log('✓ UAT copies ready (read-only, no branch)');
}

function uatEnd(name) {
	const present = cfg.repos.filter((r) => existsSync(copy(`uat-${name}`, r)));
	if (!present.length) die(`no UAT copies named ${name}`);
	for (const r of present) {
		const wt = copy(`uat-${name}`, r);
		if (git(wt, 'status', '--porcelain')) die(`${r.name} UAT copy has changed files — UAT never changes code (git -C ${wt} status)`);
	}
	for (const r of present) {
		git(clone(r), 'worktree', 'remove', copy(`uat-${name}`, r));
		console.log(`  ${r.name}: .worktrees/uat-${name}-${r.name} removed`);
	}
	console.log(`✓ ended UAT ${name}`);
}

function list() {
	if (!existsSync(WT)) return console.log('  no copies');
	for (const dir of readdirSync(WT).sort()) {
		const r = cfg.repos.find((r) => dir.endsWith(`-${r.name}`));
		if (!r) continue;
		const folder = dir.slice(0, -r.name.length - 1);
		const wt = join(WT, dir);
		const branch = git(wt, 'branch', '--show-current') || `(read-only @ ${git(wt, 'rev-parse', '--short', 'HEAD')})`;
		const port = readJson(portsFile(folder), {})[r.name] ?? '';
		console.log(`  ${folder.padEnd(28)} ${r.name.padEnd(10)} ${branch.padEnd(45)} ${String(port).padEnd(6)} ${git(wt, 'status', '--porcelain') ? 'unsaved changes' : 'clean'}`);
	}
}

function doctor() {
	let bad = 0;
	const check = (ok, label, fix) => {
		console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — ${fix}`}`);
		if (!ok) bad++;
	};
	const has = (cmd, args = ['--version']) => {
		try {
			sh(cmd, args);
			return true;
		} catch {
			return false;
		}
	};
	check(has('git'), 'git', 'install the Xcode command line tools: xcode-select --install');
	check(Number(process.versions.node.split('.')[0]) >= 18, `node ${process.versions.node}`, 'install Node 18+ from nodejs.org');
	check(has('gh'), 'GitHub command-line tool (gh)', 'brew install gh, then gh auth login');
	if (cfg.github?.account) check(has('gh', ['auth', 'token', '--user', cfg.github.account]), `gh signed in as ${cfg.github.account}`, `gh auth login, with the ${cfg.github.account} account`);
	for (const r of cfg.repos) {
		const c = clone(r);
		const remote = existsSync(c) ? tryGit(c, 'remote', 'get-url', 'origin') : null;
		check(remote?.includes(r.github), `${r.name}: ${r.clone}/ is a clone of ${r.github}`, `git clone https://github.com/${r.github}.git ${c}`);
		if (remote) check(existsSync(join(c, r.envFile ?? '.env')), `${r.name}: ${r.envFile ?? '.env'}`, 'ask your tech lead for the local .env file');
	}
	if (cfg.tunnels?.length) check(['id_ed25519.pub', 'id_rsa.pub'].some((k) => existsSync(join(process.env.HOME, '.ssh', k))), 'an SSH key (~/.ssh)', 'ssh-keygen -t ed25519, then have the public key added to the bastion');
	for (const t of cfg.tunnels ?? []) check(listening(t.port), `tunnel ${t.port} (${t.name})`, 'node scripts/dev-flow.mjs tunnels');
	console.log(bad ? `✗ ${bad} to fix` : '✓ all good');
}

// Reads with the main clone's own driver and .env, so the credentials never pass through the chat.
async function sql(query) {
	const db = cfg.db ?? die('no "db" in dev-flow.json — /dev-setup can add it');
	const repo = cfg.repos.find((r) => r.name === db.repo) ?? die(`db.repo "${db.repo}" is not one of the repos`);
	const env = parseEnv(join(clone(repo), repo.envFile ?? '.env'));
	const conn = Object.fromEntries(Object.entries(db.env).map(([k, key]) => [k, env[key]]));
	const req = createRequire(join(clone(repo), 'package.json'));
	if (db.driver === 'pg') {
		const {Client} = req('pg');
		const client = new Client({...conn, port: Number(conn.port)});
		await client.connect();
		console.log(JSON.stringify((await client.query(query)).rows, null, 1));
		await client.end();
	} else {
		const mysql = req('mysql2/promise');
		const client = await mysql.createConnection({...conn, port: Number(conn.port), dateStrings: true});
		console.log(JSON.stringify((await client.query(query))[0], null, 1));
		await client.end();
	}
}

const [cmd, a, b] = process.argv.slice(2);
const need = (n, usage) => process.argv.length - 3 >= n || die(`usage: node scripts/dev-flow.mjs ${usage}`);
switch (cmd) {
	case 'start': need(2, 'start <folder> <branch>'); start(a, b); break;
	case 'end': need(1, 'end <folder>'); end(a); break;
	case 'uat-start': need(1, 'uat-start <name>'); uatStart(a); break;
	case 'uat-end': need(1, 'uat-end <name>'); uatEnd(a); break;
	case 'list': list(); break;
	case 'tunnels': tunnels(); break;
	case 'doctor': doctor(); break;
	case 'sql': need(1, 'sql "<query>"'); await sql(a); break;
	default: console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split("\n").slice(1, 14).join('\n')); process.exit(1);
}
