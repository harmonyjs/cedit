import { execa } from 'execa';
import path from 'node:path';

const DEP_CRUISE_CMD = 'npx';
const DEP_CRUISE_ARGS = ['depcruise', 'src', '--config', 'dependency-cruiser.cjs', '--output-type', 'json'];

function isDownwardIndexImport(fromPath, toPath) {
  if (!new RegExp(`${path.sep}index\\.(ts|js)$`).test(toPath)) {
    return false;
  }
  const fromDirs = path.dirname(fromPath).split(path.sep);
  const toDirs = path.dirname(toPath).split(path.sep);
  return (
    fromDirs.length > toDirs.length &&
    fromDirs.slice(0, toDirs.length).every((p, i) => p === toDirs[i])
  );
}

async function main() {
  const { stdout } = await execa(DEP_CRUISE_CMD, DEP_CRUISE_ARGS);
  const result = JSON.parse(stdout);
  if (result.summary.error > 0) {
    console.error('Dependency Cruiser reported violations');
    process.exit(1);
  }
  const violations = [];

  for (const mod of result.modules) {
    for (const dep of mod.dependencies) {
      if (isDownwardIndexImport(mod.source, dep.resolved)) {
        violations.push(`${mod.source} -> ${dep.resolved}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error('Downward index imports detected:\n' + violations.join('\n'));
    process.exit(1);
  } else {
    console.log('✔ no downward index imports found');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
