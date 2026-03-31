import { execSync } from 'node:child_process';

function readGitConfig(key) {
  try {
    return execSync(`git config --get ${key}`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const name = readGitConfig('user.name');
const email = readGitConfig('user.email').toLowerCase();

if (!name || !email) {
  process.stdout.write('{}\n');
  process.exit(0);
}

const payload = {
  attribution: {
    gitUser: {
      name,
      email,
    },
  },
};

process.stdout.write(`${JSON.stringify(payload)}\n`);
