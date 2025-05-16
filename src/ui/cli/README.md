# CLI Module Architecture (src/ui/cli)

This document outlines the architecture of the `ui/cli` module for the `cedit` application. This module is responsible for providing a command-line interface to interact with the core application logic.

## 1. Overview

The CLI module handles:
- Parsing command-line arguments and options.
- Loading and validating configuration from files, environment variables, and CLI flags.
- Initializing necessary services (logging, resource management, progress monitoring).
- Orchestrating the execution flow based on user input.
- Handling user interactions (like confirmations).
- Displaying progress and feedback to the user.
- Managing application lifecycle events (start, completion, errors).

## 1.1. Usage Examples

Basic execution with a spec file:
```bash
cedit ./specs/add-comments.yml
```

Dry run to see planned changes without applying them:
```bash
cedit ./specs/add-comments.yml --dry-run
```

Override a variable defined in the spec file:
```bash
cedit ./specs/add-comments.yml --var "targetLanguage=Python"
```

Skip confirmation prompts:
```bash
cedit ./specs/add-comments.yml --yes
```

Set log level:
```bash
cedit ./specs/add-comments.yml --log-level debug
```

## 1.2. High-Level Architecture Diagram

The CLI module follows a layered approach, orchestrating various components to process user commands:

```
+---------------------+     +-----------------------+
|    index.ts (root)  |<--->|   ui/cli/index.ts     |
| (CLI Entry Point)   |     | (runCli)              |
+---------------------+     +-----------------------+
        ^                                 |
        |                                 v
+---------------------+     +---------------------------------------------------+
|   process.argv      |     | execution/setup.ts (performInitialSetup)          |
+---------------------+     |  - execution/parser.ts (parseArguments)           |
                            |  - config/loader.ts (loadConfiguration)           |
                            |  - services/version-manager.ts (getVersion)       |
                            |  - infra/logging (getLogger)                      |
                            +---------------------------------------------------+
                                                    |
                                                    v
+-----------------------------------------------------------------------------------+
| execution/flow.ts (continues)                                                     |
|  - handlers/confirmation-handler.ts (handleConfirmation)                          |
|  - services/progress-monitor.ts (ProgressMonitor)                                 |
|  - handlers/completion-handler.ts (CompletionHandler)                             |
|  - execution/lifecycle.ts (startProcessing) -> app/runner (runFn)                 |
+-----------------------------------------------------------------------------------+
```

## 2. Directory Structure

The `ui/cli` module is organized into the following subdirectories:

```
src/ui/cli/
├── config/         # Configuration loading, validation, and parsing
├── execution/      # Core CLI execution flow, lifecycle, and argument parsing
├── handlers/       # Event handlers for CLI interactions (completion, confirmation)
├── services/       # Utility services (progress monitoring, resource management, versioning)
├── index.ts        # Core CLI orchestration logic (was main.ts)
└── README.md       # This document
```

### 2.1. `config/`

This directory contains all logic related to CLI configuration.

-   `definitions.ts`: Defines the metadata and structure for CLI configuration options. It specifies how different configuration values (from flags, environment variables, or files) are identified and processed.
-   `loader.ts`: Responsible for loading configuration from various sources and merging them into a single `CliConfig` object. The precedence for merging is: 1. CLI flags, 2. Environment variables, 3. Configuration file values (direct paths), 4. Configuration file values (from `defaults` section), 5. Hardcoded defaults. It also processes `--var` arguments into the `varsOverride` field of the `CliConfig`.
-   `schemas.ts`: Contains Zod schemas used to validate the structure and types of values read from configuration files. This ensures that the configuration conforms to expected formats.
-   `value-parsers.ts`: Provides utility functions to parse specific types of configuration values (e.g., strings, booleans, numbers, paths, log levels) from raw input (usually strings from YAML or environment variables).
-   `index.ts`: Barrel file, re-exporting key components from the `config` module.

### 2.2. `execution/`

This directory manages the core execution logic and lifecycle of the CLI.

-   `parser.ts`: Handles parsing of raw command-line arguments (`process.argv`) using the `commander` library via the `parseArguments` function. It defines available CLI commands, options, and flags, and transforms them into a structured `CliFlags` object. It also performs initial validation of critical flags.
-   `setup.ts`: Orchestrates the initial setup phase of the CLI via the `performInitialSetup` function. This includes retrieving the application version (using `getVersion` from `services/version-manager.ts`), parsing arguments (via `parseArguments` from `parser.ts`), loading the full configuration (via `loadConfiguration` from `config/loader.ts`), and initializing the logger.
-   `flow.ts`: Contains the main orchestration logic for the CLI's operational flow after the initial setup, primarily within the `orchestrateExecution` function. It handles user confirmation, initializes services like `ProgressMonitor` and `CompletionHandler`, emits initial configuration events, and starts the main processing task by calling `startProcessing`.
-   `lifecycle.ts`: Provides helper functions related to the CLI's lifecycle stages. It includes `startProcessing`, which invokes the core application `runFn`. This module is also responsible for ensuring that if `runFn` throws an error, a `FINISH_ABORT` event is emitted on the application bus, allowing `CompletionHandler` to manage the CLI exit.
-   `index.ts`: Barrel file, re-exporting key components from the `execution` module.

### 2.3. `handlers/`

This directory contains handlers for specific CLI events and interactions.

-   `completion-handler.ts`: The `CompletionHandler` class manages the completion phase of the CLI. It listens for `FINISH_SUMMARY` (success) or `FINISH_ABORT` (failure/cancellation) events from the application's event bus. Based on these events, it logs appropriate messages to the console and determines the final exit code for the CLI process.
-   `confirmation-handler.ts`: The `handleConfirmation` function handles user confirmation prompts. If the CLI is run in an interactive TTY environment and the `--yes` flag is not provided, this handler waits for a TUI (Text User Interface) event indicating whether the user confirmed or cancelled an operation.
-   `index.ts`: Barrel file, re-exporting key components from the `handlers` module.

### 2.4. `services/`

This directory provides various utility services used by the CLI.

-   `progress-monitor.ts`: The `ProgressMonitor` class monitors application events (e.g., `DOMAIN_FILE_VIEWED`, `DOMAIN_FILE_EDITED`, `DOMAIN_ERROR`) from the event bus and periodically displays a summary of progress (items viewed, edited, errors) to the console.
-   `resource-manager.ts`: Intended for managing resources that require explicit cleanup (e.g., event listeners not handled by other specific components). Its current role is minimal as `ProgressMonitor` and `CompletionHandler` manage their own listeners.
-   `version-manager.ts`: The `getVersion` function is responsible for retrieving the application's version, typically by reading it from the `package.json` file.
-   `index.ts`: Barrel file, re-exporting key components from the `services` module.

## 3. Key Files

-   `src/index.ts`: This is the primary entry point for the CLI application (the executable script). It imports the main `runCli` function from `ui/cli/index.ts` and the core application `run` function and `getLogger` utility. It then invokes `runCli` with `process.argv` and these dependencies, handling the final promise resolution to set the process exit code or catch critical top-level errors.
-   `src/ui/cli/index.ts`: Contains the `runCli` function, which is the central orchestrator for the CLI. It initializes the execution flow by calling `orchestrateExecution` from `execution/flow.ts`. It also defines shared interfaces like `CliFlags` and `CommanderOptionValues` and includes a top-level critical error handler.

## 4. Core Workflow

The CLI follows a structured workflow:

1.  **Entry (`src/index.ts`):**
    *   The `#!/usr/bin/env node` shebang makes the script executable.
    *   `runCli` from `ui/cli/index.ts` is called with `process.argv`, the application's main `run` function, and `getLogger`.

2.  **Initialization (`ui/cli/index.ts` -> `execution/flow.ts` -> `execution/setup.ts`):**
    *   `orchestrateExecution` (in `flow.ts`) is called.
    *   `performInitialSetup` (in `setup.ts`) is invoked:
        *   Retrieves the application version (`getVersion` from `services/version-manager.ts`).
        *   Parses command-line arguments using `commander` (`parseArguments` from `parser.ts`) into `CliFlags`. This includes validation of required arguments like the spec file.
        *   Loads configuration (`loadConfiguration` from `config/loader.ts`):
            *   The configuration is built by layering sources with the following precedence (highest to lowest):
                1.  CLI flags (e.g., `--log-level`).
                2.  Environment variables (e.g., `CEDIT_LOG_LEVEL`).
                3.  Values from `cedit.yml` (or other named config files).
                4.  Default values specified within the `defaults` section of `cedit.yml`.
                5.  Hardcoded default values in `config/loader.ts`.
            *   Validates file content using Zod schemas (`schemas.ts`).
            *   Parses specific values using `value-parsers.ts`.
            *   Processes `--var` arguments into `varsOverride`.
        *   Initializes the logger (`infra/logging`) with the resolved configuration.
    *   Returns the initialized `log`, `flags`, and `cliCfg` to `orchestrateExecution`.

3.  **Service Initialization & Pre-Execution (`execution/flow.ts`):**
    *   `ResourceManager`, `ProgressMonitor`, and `CompletionHandler` are instantiated.
    *   The `INIT_CONFIG` event is emitted on the application bus with the loaded `cliCfg`.
    *   `ProgressMonitor` starts listening for progress events.
    *   `CompletionHandler` starts listening for finish/abort events.

4.  **User Confirmation (Optional) (`execution/flow.ts` -> `handlers/confirmation-handler.ts`):**
    *   If not a dry run and the `--yes` flag is not provided, `handleConfirmation` is called.
    *   If in a TTY, it waits for the TUI to emit an `INIT_COMPLETE` event (user confirms or cancels).
    *   If not confirmed, the CLI exits gracefully.

5.  **Main Processing (`execution/flow.ts` -> `execution/lifecycle.ts` -> App Runner):**
    *   `startProcessing` (in `lifecycle.ts`) is called.
    *   This function invokes the main application `runFn` (passed from `index.ts`, which is `app/runner/index.ts#run`) with the spec file path and the resolved `CliConfig`.
    *   The `runFn` executes the core logic of `cedit`.
    *   Any errors during `runFn` execution are caught within `startProcessing` (in `lifecycle.ts`), and a `FINISH_ABORT` event is emitted on the application bus.

6.  **Completion (`handlers/completion-handler.ts`):**
    *   `CompletionHandler`'s `awaitCompletion` promise resolves when either `FINISH_SUMMARY` (on success) or `FINISH_ABORT` (on error/cancellation) is received.
    *   It logs a summary message to the console.
    *   It returns an exit code (0 for success, 1 for failure).

7.  **Cleanup (`execution/flow.ts`):**
    *   `ProgressMonitor` and `CompletionHandler` stop listening to events (their `stop` or `stopListening` methods are called).
    *   `ResourceManager` performs its cleanup (if any resources were registered).

8.  **Exit (`index.ts`):**
    *   The exit code returned by `runCli` (ultimately from `CompletionHandler`) is used with `process.exit()`.
    *   A top-level catch block in `index.ts` handles any unhandled promise rejections from `runCli`, prints a critical error message, and exits with code 1.

## 5. Key Architectural Principles

-   **Separation of Concerns:** Different aspects of the CLI (config, argument parsing, execution flow, UI feedback) are handled by distinct modules and services.
-   **Configuration Layers:** Configuration is sourced from multiple layers with a clear precedence, providing flexibility. The order is: CLI flags > Environment variables > Config file (direct values > `defaults` section values) > Hardcoded defaults.
-   **Event-Driven Updates:** Services like `ProgressMonitor` and `CompletionHandler` react to events on a central event bus (`app/bus`) rather than being tightly coupled to the core application logic.
-   **Structured Error Handling:** Errors are handled at different levels, with specific handlers for parsing errors, runtime errors within the main application, and critical top-level errors.
-   **Modularity:** The CLI is broken down into smaller, manageable files and modules, each with a specific responsibility. Barrel files (`index.ts` in subdirectories) are used to simplify imports.

This architecture aims to create a maintainable, testable, and extensible command-line interface for the `cedit` application.

## 6. Dependencies

The `ui/cli` module relies on several external libraries and internal modules:

### External Dependencies:
-   `chalk`: Used for styling console output with colors.
-   `commander`: A complete solution for node.js command-line interfaces, used for parsing arguments and options.
-   `yaml`: For parsing YAML configuration files (`cedit.yml`).
-   `zod`: (Used by `config/schemas.ts`) For schema declaration and validation of configuration files.

### Internal Dependencies:
-   `src/app/bus`: The application-wide event bus used for communication between CLI components (e.g., `ProgressMonitor`, `CompletionHandler`) and the core application.
-   `src/app/model`: Provides core data structures like `CliConfig`.
-   `src/app/runner`: Contains the main application logic (`run` function) invoked by the CLI.
-   `src/infra/logging`: Provides the logging infrastructure.

## 7. Testing

Unit and integration tests for the CLI module are co-located with the source code or within the top-level `tests/` directory (e.g., `tests/cli.test.ts`, `tests/cli-config.test.ts`). These tests cover argument parsing, configuration loading, and overall execution flow.

To run tests, use the script defined in `package.json`, typically:
```bash
npm test
```
Or to target specific CLI tests, you might use a command like:
```bash
npm test -- tests/cli.test.ts
```
