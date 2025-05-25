# cedit

A CLI utility that leverages Anthropic **Claude 3 Sonnet v3.7** and its native `text_editor_20250124` tool to view, edit, insert, replace and create files directly from your terminal.

---

## ✨ Key Features

| Capability                    | Description                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Prompt‑driven edits**       | Provide a YAML spec with system & user prompts plus optional file attachments.                        |
| **Native tool use**           | Claude executes `view`, `str_replace`, `insert`, `create`, `undo_edit`; `cedit` applies them locally. |
| **Safety first**              | Backups for every touched file go to `$TMPDIR/cedit/backups/…`; dry‑run + coloured diff preview.      |
| **Config by file or flags**   | Global or project‑local `.cedit.yml` overrides; any CLI flag wins.                                    |
| **Low‑coupling architecture** | Domain core is UI‑agnostic; UI/TUI, file storage and LLM layers are pluggable.                        |
| **Extensible CLI**            | Add flags in one place (`ui/cli/flags.ts`) and they propagate automatically.                          |

---

## 📦 Installation

```bash
# Install globally
npm install -g cedit

# Or use directly with npx
npx cedit <spec.yml> [options]
```

### Requirements
- Node.js 23+ (ESM)
- Anthropic API key (set via `.cedit.yml` or environment)

---

## 🚀 Usage

```bash
cedit <spec.yml> [-v key value …] [--dry-run] [--max-tokens N]
                 [--model claude‑3‑7‑sonnet‑20250219]
                 [--log-level info|error] [--retries 3]
```

### Example YAML Spec

```yaml
system: |
  You are a code assistant that helps developers.
  
user: |
  Please add {{var.object}} to functions located in the file.
  Make sure to include explanations for all parameters and return values.
  
attachments:
  - path/to/math.ts
  
variables:
  object: TSDoc comments
```

### Options

| Option                 | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `-v, --var <key> <val>` | Override variables from spec                                  |
| `--dry-run`            | Preview changes without modifying files                       |
| `--max-tokens <num>`   | Maximum tokens for Claude response                            |
| `--model <model>`      | Claude model to use (default: claude‑3‑7‑sonnet‑20250219)     |
| `--log-level <level>`  | Log level: info or error (default: info)                      |
| `--retries <num>`      | Number of retries for API calls (default: 3)                  |
| `--yes`                | Skip confirmation prompt                                      |

### Configuration

Create a `.cedit.yml` file in your project or home directory:

```yaml
anthropic_api_key: "your-api-key"  # Or set via environment variable
model: "claude-3-7-sonnet-20250219"
retries: 3
sleep_between_requests_ms: 500
log:
  level: "info"
  dir: "/path/to/logs"
backup:
  dir: "$TMPDIR/cedit/backups"
  keep_for_days: 0  # Keep forever
defaults:
  dry_run: false
  max_tokens: 4096
```

---

## 🏗️ Architecture

The project is built with a layered architecture that enforces strict separation of concerns:

### Core Components

| Layer                | Description                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **app/model**        | Contains domain types (Spec, ToolUse, DomainEvents) that define the core data structures used across all layers |
| **app/editor**       | Interprets ToolUse commands from Claude and applies them via storage, emitting DomainEvents                    |
| **app/runner**       | Orchestrates the end-to-end flow: config → LLM → editor → events → summary                                     |
| **app/bus**          | Type-safe event bus that facilitates communication between components without tight coupling                    |

### Infrastructure

| Layer                | Description                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **infra/llm**        | Wraps Anthropic SDK with streaming, token limits, retries, and rate-limiting                                   |
| **infra/storage**    | Handles file operations, backups, and diff statistics safely                                                   |
| **infra/logging**    | Provides a unified logging interface using Pino                                                                |

### User Interface

| Layer                | Description                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **ui/cli**           | Command-line interface using Commander (flags, config, execution)                                              |
| **ui/tui**           | Interactive terminal UI with Clack (spinners, confirmations, prompts)                                          |

### Flow Diagram

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  ui/cli   │────>│           │     │           │     │  ui/tui   │
└───────────┘     │ app/runner│<───>│  app/bus  │<────┘───────────┘
                  │           │     │           │
                  └─────┬─────┘     └─────┬─────┘
                        │                 │
                        v                 v
                  ┌───────────┐     ┌───────────┐     
                  │app/editor │<───>│ app/model │     
                  └─────┬─────┘     └───────────┘     
                        │                             
                        v                             
          ┌─────────────┼─────────────┐              
          │             │             │              
          v             v             v              
    ┌──────────┐  ┌──────────┐  ┌──────────┐        
    │infra/llm │  │infra/stor│  │infra/log │        
    └──────────┘  └──────────┘  └──────────┘        
```

This architecture ensures:
- **Separation of concerns**: Each module has a clear single responsibility
- **Dependency rules**: Lower layers never import from higher layers
- **Testability**: Components can be tested in isolation with mocks
- **Extensibility**: Easy to add new functionality without modifying existing code

---

## � Development Guidelines

### Terminal Output Standards

This project enforces centralized terminal output through the logging system. **All output must use `getLogger()` instead of direct `console.*` or `process.std*.write()` calls.**

Key principles:
- ✅ Use `logger.info()`, `logger.error()`, `logger.warn()`, `logger.debug()`
- ❌ Never use `console.log()`, `console.error()`, etc.
- 🔗 Logger output automatically integrates with TUI display
- 📋 ESLint rules enforce these standards

For detailed guidelines, exceptions, and examples, see: [**Terminal Output Guidelines**](src/ui/tui/TERMINAL_OUTPUT.md)

### Development Workflow

1. **Code Quality Gates**: All changes must pass:
   ```bash
   npm run lint      # ESLint validation
   npm run typecheck # TypeScript compilation
   npm run test      # Full test suite
   npm run depcheck  # Dependency analysis
   ```

2. **Architecture Compliance**: Follow the layered architecture and dependency rules
3. **Documentation**: Keep code comments and docs synchronized with changes

---

## �📜 License

MIT © 2025 Andrey Vavilov
