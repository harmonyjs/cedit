/**
 * Manages CLI version retrieval.
 */
import * as fs from 'node:fs/promises';

/**
 * Retrieves the application version from package.json.
 * @returns A promise that resolves to the version string.
 */
export async function getVersion(): Promise<string> { // Renamed function
  const pkgJsonPath = new URL('../../../../package.json', import.meta.url); // Adjusted path
  const pkgContent = await fs.readFile(pkgJsonPath, 'utf8');
  const pkg: unknown = JSON.parse(pkgContent);
  return typeof pkg === 'object' && pkg !== null && 'version' in pkg && typeof pkg.version === 'string'
    ? pkg.version
    : '0.0.0';
}
