import { execFileSync } from 'node:child_process';

function run(bin, args, options = {}) {
  return execFileSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const branch = run('git', ['branch', '--show-current']);
if (!branch) fail('Missing current branch');
if (branch === 'main') fail('Merge-readiness verifier must not run on main');

const status = run('git', ['status', '--short']);
if (status !== '') fail('Working tree must be clean');

const prJson = run('gh', [
  'pr',
  'view',
  branch,
  '--repo',
  'robertsc2049-bit/kolosseum',
  '--json',
  'number,title,state,isDraft,baseRefName,headRefName',
]);

let pr;
try {
  pr = JSON.parse(prJson);
} catch {
  fail('Failed to parse PR view JSON');
}

if (pr.state !== 'OPEN') fail(`PR must be OPEN, got ${pr.state}`);
if (pr.isDraft) fail('PR must not be draft');
if (pr.baseRefName !== 'main') fail(`PR base must be main, got ${pr.baseRefName}`);
if (pr.headRefName !== branch) fail(`PR head must match current branch, got ${pr.headRefName}`);

const checksOutput = run('gh', [
  'pr',
  'checks',
  String(pr.number),
  '--repo',
  'robertsc2049-bit/kolosseum',
]);

if (!checksOutput.includes('All checks were successful')) {
  fail('PR checks are not fully green');
}

console.log('POSTV1_MERGE_READINESS_OK');