import { execFileSync } from 'node:child_process';

function run(bin, args) {
  return execFileSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runInherited(bin, args) {
  execFileSync(bin, args, {
    stdio: 'inherit',
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const branch = run('git', ['branch', '--show-current']);
if (!branch) fail('Missing current branch');
if (branch !== 'main') fail(`Post-merge verification must run on main, got ${branch}`);

const status = run('git', ['status', '--short']);
if (status !== '') fail('Working tree must be clean');

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

runInherited(npmBin, ['run', 'lint:fast']);
runInherited(npmBin, ['run', 'build:fast']);

console.log('POSTV1_MAINLINE_POST_MERGE_VERIFICATION_OK');