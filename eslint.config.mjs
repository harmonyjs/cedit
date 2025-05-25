/**
 * ESLint flat-config for project **cedit**
 * ─────────────────────────────────────────────────────────────────────────────
 * 💡 Порядок блоков в flat-config:
 * 1. Игнорируемые файлы (`ignores`).
 * 2. Глобальная регистрация плагинов (`plugins`), особенно важен алиас `eslint: js`.
 * 3. Базовые пресеты (например, `js.configs.recommended`).
 * 4. Конфигурации для конкретных расширений файлов или директорий (например, для `*.js`, `*.mjs`, `src/**\/*.ts`).
 *
 * Соблюдение этого порядка и правильная регистрация плагинов помогают избежать
 * таких ошибок, как «Plugin "." not found» и обеспечивают предсказуемое поведение правил.
 * Ключевым для работы с `@typescript-eslint` в ESLint v9+ является алиас `eslint: js`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals'; // Added import

// 1. Общие константы ----------------------------------------------------------
const NODE_GLOBALS = { ...globals.node };

const STYLE_RULES = {
  'no-console': 'off',
  'no-duplicate-imports': 'error',
  'no-multi-assign': 'error',
  'no-param-reassign': 'error',
  eqeqeq: ['error', 'always'],
  'max-classes-per-file': ['error', 1],
  'max-depth': ['error', 4],
  'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 50,  skipBlankLines: true, skipComments: true }],
  'max-params': ['error', { max: 3 }], // Updated from 4 to 3
  'prefer-const': 'error',
  'prefer-promise-reject-errors': 'error',
  'require-await': 'error',
  'class-methods-use-this': 'error', // Added
  'consistent-return': 'error', // Added
  // Centralize terminal output through logging system
  'no-restricted-properties': ['error',
    // Prohibit console methods
    {
      object: 'console',
      property: 'log',
      message: 'Use logger.info() from getLogger() instead of console.log()'
    },
    {
      object: 'console',
      property: 'error',
      message: 'Use logger.error() from getLogger() instead of console.error()'
    },
    {
      object: 'console',
      property: 'warn',
      message: 'Use logger.warn() from getLogger() instead of console.warn()'
    },
    {
      object: 'console',
      property: 'info',
      message: 'Use logger.info() from getLogger() instead of console.info()'
    },
    {
      object: 'console',
      property: 'debug',
      message: 'Use logger.debug() from getLogger() instead of console.debug()'
    },
    // Prohibit direct stream writes
    {
      object: 'process.stdout',
      property: 'write',
      message: 'Use logger from getLogger() instead of process.stdout.write()'
    },
    {
      object: 'process.stderr',
      property: 'write',
      message: 'Use logger from getLogger() instead of process.stderr.write()'
    }
  ],
};

const TS_SPECIFIC_RULES = {
  complexity: ['error', 10],
  '@typescript-eslint/no-unused-vars': ['error', {
    vars: 'all',
    args: 'after-used',
    ignoreRestSiblings: true,
    caughtErrorsIgnorePattern: '^_',
  }],
  '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: false, allowHigherOrderFunctions: false }],
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/strict-boolean-expressions': ['error', { allowString: false, allowNumber: false, allowNullableBoolean: false }],
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', disallowTypeAnnotations: false }],
  '@typescript-eslint/consistent-type-exports': 'error',
  // User should configure paths and patterns based on project structure for FSD/layer enforcement
  '@typescript-eslint/no-restricted-imports': ['error', { paths: [], patterns: [] }],
  '@typescript-eslint/no-magic-numbers': ['error', { ignore: [0, 1, -1, Infinity], ignoreEnums: true, ignoreNumericLiteralTypes: true }],
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  '@typescript-eslint/member-ordering': ['error', {
    default: [
      'signature',
      // fields
      'public-static-field',
      'private-static-field',
      'public-instance-field',
      'private-instance-field',
      // constructors
      'public-constructor',
      'private-constructor',
      // methods
      'public-instance-method',
      'private-instance-method',
      'private-static-method',
      'public-static-method',
    ],
  }],
  '@typescript-eslint/naming-convention': [
    'error',
    { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
    { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
    { selector: 'typeLike', format: ['PascalCase'] },
    { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
    { selector: 'function', format: ['camelCase'] },
    { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
    { selector: 'property', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
    { selector: 'method', format: ['camelCase'] },
  ],
};

// Base config for JavaScript files (to be extended for CJS and ESM)
const JS_BASE = {
  languageOptions: {
    ecmaVersion: 'latest',
    globals: NODE_GLOBALS,
  },
  rules: STYLE_RULES,
};

// ────────────────────────── Конфигурация ───────────────────────
export default defineConfig([
  // 1️⃣ Игнорируемые файлы -----------------------------------------------------
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.vscode/**',
      'eslint.config.mjs', // Конфиг линтера обычно исключают из линтинга.
      'dependency-cruiser.cjs',
    ],
  },

  // 1️⃣ Регистрация всех плагинов «база» --------------------------------------
  {
    plugins: {
      eslint: js, // Core ESLint rules aliased as 'eslint'. CRITICAL for @typescript-eslint presets in flat config.
      '@typescript-eslint': tsPlugin,
    },
  },

  // 2️⃣ Базовый JS-пресет (для всех файлов, включая .js, .mjs, .cjs) ---------
  js.configs.recommended,

  // --- CommonJS / обычный .js, .cjs -----------------------------------------
  {
    files: ['**/*.js', '**/*.cjs'],
    ...JS_BASE,
    languageOptions: {
      ...JS_BASE.languageOptions,
      sourceType: 'commonjs',
    },
    rules: {
        ...JS_BASE.rules,
        'no-unused-vars': 'off',
    }
  },

  // --- ES-модули .mjs --------------------------------------------------------
  {
    files: ['**/*.mjs'],
    ...JS_BASE,
    languageOptions: {
      ...JS_BASE.languageOptions,
      sourceType: 'module',
    },
  },

  // 3️⃣ TypeScript type-aware rules for src files.
  // We use .map() on tsPlugin.configs['flat/recommended-type-checked'] (which is an array of configs)
  // to ensure each resulting config object is explicitly scoped to 'src' files and
  // correctly references './tsconfig.json'. This is crucial because our tsconfig.json
  // only includes 'src', and this approach prevents type-aware rules from erroring
  // on TypeScript files outside 'src' (e.g., in specs/, tests/).
  ...(tsPlugin.configs['flat/recommended-type-checked'].map(config => ({
    ...config, // Spread the original config from the preset
    files: ['src/**/*.ts', 'src/**/*.tsx'], // Apply only to src TypeScript files
    languageOptions: {
      ...config.languageOptions, // Preserve existing languageOptions from preset
      parser: tsParser, // Ensure our parser is set
      parserOptions: {
        ...(config.languageOptions?.parserOptions), // Preserve existing parserOptions
        project: './tsconfig.json', // Explicit project path
      },
      globals: {
        ...NODE_GLOBALS,
        ...(config.languageOptions?.globals), // Preserve and merge globals
      }
    },
    rules: {
      ...config.rules, // Rules from flat/recommended-type-checked
      ...STYLE_RULES,    // Apply STYLE_RULES
      ...TS_SPECIFIC_RULES, // Apply TS_SPECIFIC_RULES
    }
  }))),

  // 4️⃣ Special rules for test files and tools - allow console usage
  {
    files: [
      'tests/**/*.ts', 
      'tests/**/*.js', 
      '**/*.test.ts', 
      '**/*.spec.ts',
      'tools/**/*.mjs',
      'tools/**/*.js',
      'tools/**/*.ts'
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Don't use project for tests and tools - they may not be in tsconfig.json
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: NODE_GLOBALS,
    },
    rules: {
      'no-restricted-properties': 'off', // Allow console usage in tests and tools
      '@typescript-eslint/no-unsafe-member-access': 'off', // Relax for tests
      '@typescript-eslint/no-unsafe-assignment': 'off', // Relax for tests
      '@typescript-eslint/no-unsafe-call': 'off', // Relax for tests
      '@typescript-eslint/no-unsafe-return': 'off', // Relax for tests
    },
  },
]);
