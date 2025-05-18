import { intro, log, text, select, isCancel, cancel } from '@clack/prompts';
import * as fsSync from 'node:fs';
import chalk from 'chalk';

export async function promptSpecPath(): Promise<string | null> {
  const specPath = await text({
    message: 'Spec file to run?',
    validate: (value) => {
      if (!value) return 'Please enter a spec file path';
      try {
        fsSync.accessSync(value);
        return undefined;
      } catch (_error) {
        return `File not found: ${value}`;
      }
    }
  });
  if (isCancel(specPath)) {
    cancel('Operation cancelled.');
    return null;
  }
  return specPath;
}

export async function promptVariables(): Promise<Record<string, string> | null> {
  const variables: Record<string, string> = {};
  let continueVars = true;
  log.step('Override variables (key=value, blank to finish)');
  while (continueVars) {
    const varInput = await text({
      message: 'Variable (key=value)',
      placeholder: 'e.g. output_path=./result.md',
    });
    if (isCancel(varInput)) {
      cancel('Operation cancelled.');
      return null;
    }
    if (!varInput) {
      continueVars = false;
    } else {
      const parts = (varInput).split('=');
      if (parts.length === 2) {
        variables[parts[0].trim()] = parts[1].trim();
      } else {
        log.warn('Invalid format. Use key=value');
      }
    }
  }
  return variables;
}

export async function promptDryRun(): Promise<boolean | null> {
  const dryRun = await select({
    message: 'Dry‑run first?',
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' }
    ]
  });
  if (isCancel(dryRun)) {
    cancel('Operation cancelled.');
    return null;
  }
  return dryRun;
}

export async function gatherUserInput(): Promise<{
  specPath: string;
  variables: Record<string, string>;
  dryRun: boolean;
} | null> {
  intro(chalk.inverse(' cedit interactive CLI '));
  const specPath = await promptSpecPath();
  if (!specPath) return null;
  const variables = await promptVariables();
  if (!variables) return null;
  const dryRun = await promptDryRun();
  if (dryRun === null) return null;
  return { specPath, variables, dryRun };
}
