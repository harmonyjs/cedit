import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import js from "@eslint/js";
import globals from "globals";

export default defineConfig([
    // Start with global ignores
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            ".vscode/**",
            "eslint.config.mjs", // Explicitly ignore the ESLint config file itself from TS parsing
            "dependency-cruiser.cjs",
        ],
    },
    
    // Configuration for JavaScript files (.js, .cjs)
    {
        files: ["**/*.js", "**/*.cjs"],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs", // Assuming .cjs files are CommonJS
            globals: {
                ...globals.node,
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            "no-unused-vars": "off", // Disable the base rule
            "no-console": "off",
            "max-depth": ["error", 4], // Added max-depth rule
            "max-params": ["error", 4],
        },
    },
    {
        // Configuration for ESModule JavaScript files (.mjs)
        // These are not parsed with typescript-eslint
        files: ["**/*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node, // Or browser, depending on the context of .mjs files
            }
        },
        rules: {
            "no-console": "off",
            "max-depth": ["error", 4], // Added max-depth rule
            "max-params": ["error", 4],
        },
    },
    {
        // Configuration for TypeScript files
        files: ["src/**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            parser: tsParser,
            sourceType: "module",
            parserOptions: {
                project: "./tsconfig.json",
            },
            globals: {
                ...globals.node, // Assuming TS files are for Node.js environment
            }
        },
        rules: {
            ...typescriptEslint.configs["eslint-recommended"].rules,
            ...typescriptEslint.configs["recommended-type-checked"].rules,
            "complexity": ["error", 10], // Added complexity rule
            "max-depth": ["error", 4], // Added max-depth rule
            "max-params": ["error", 4],
            // Then enable TypeScript-specific version with custom configuration
            "@typescript-eslint/no-unused-vars": ["error", {
                vars: "all",                     // Check all variables
                args: "after-used",              // Consider params used if any params to their right are used
                ignoreRestSiblings: true,        // Ignore rest pattern variables like `const { a, ...rest } = obj`
                caughtErrorsIgnorePattern: "^_", // Skip any caught errors starting with underscore
            }],
        },
    },
]);