<rules type="strict" priority="critical">
  <!-- CORE DEVELOPMENT FLOW -->
  <rule>
    <name>Comprehensive Pre‑Work Analysis</name>
    <description>
      • Break every task into explicit subtasks.
      • Identify which files must change and how each change affects the whole project.
      • Ensure proposed work preserves architectural consistency and existing conventions.
    </description>
    <rationale>
      Up‑front analysis prevents architectural drift, hidden side effects, and wasted effort.
    </rationale>
    <tags>analysis,planning,architecture,consistency</tags>
  </rule>
  <rule>
    <name>Minimal, Purpose‑Driven Implementation</name>
    <description>
      Implement only what is strictly required to satisfy the task—no feature creep and no speculative abstractions.
    </description>
    <rationale>
      Focus keeps the codebase lean, reviewable, and maintainable.
    </rationale>
    <tags>yagni,minimalism,scope-control</tags>
  </rule>
  <rule>
    <name>Run Lint, Typecheck, and Tests</name>
    <description>
      After every change you must run:
      1. npm run lint
      2. npm run typecheck
      3. npm run depcheck
      4. npm run test
      All four commands must pass without errors; fix issues before committing.
    </description>
    <rationale>
      Guards against regressions and enforces quality gates automatically.
    </rationale>
    <tags>lint,test,typescript,ci</tags>
  </rule>
  <!-- CODE STYLE & STRUCTURE -->
  <rule>
    <name>Idiomatic, Well‑Commented Code</name>
    <description>
      • Write clear TypeScript or JavaScript that matches the existing style for indentation, quotes, and imports.
      • Add JSdoc and ASCII‑art diagrams where helpful, explaining why code exists rather than just what it does.
      • Favor pure functions; if side effects are unavoidable, document them explicitly.
    </description>
    <rationale>
      Readable, documented code accelerates onboarding and future refactors.
    </rationale>
    <tags>style,comments,pure-functions,documentation</tags>
  </rule>
  <rule>
    <name>Modular Design & File Size Limits</name>
    <description>
      • Decompose logic into small self‑contained modules or functions.
      • No source file may exceed 200 lines; refactor or split when approaching the limit.
    </description>
    <rationale>
      Smaller units are easier to test, reason about, and reuse.
    </rationale>
    <tags>modularity,refactor,file-size</tags>
  </rule>
  <rule>
    <name>Avoid Hollow Static‑Only Classes & Over‑Abstraction</name>
    <description>
      • Do not wrap unrelated helpers in classes of static methods; use plain modules or namespaces.
      • Introduce abstraction layers only when they are demonstrably necessary.
    </description>
    <rationale>
      Prevents needless complexity and keeps APIs straightforward.
    </rationale>
    <tags>abstraction,oop,modules</tags>
  </rule>
  <rule>
    <name>Kebab‑Case Project Layout</name>
    <description>
      • All directory and file names must use kebab‑case.
      • Keep the project layout pragmatic; avoid heavy domain‑driven design if it hurts clarity.
    </description>
    <rationale>
      Consistent naming improves discoverability across the repo.
    </rationale>
    <tags>filesystem,naming,structure</tags>
  </rule>
  <!-- IMPORT RULES -->
  <rule>
    <name>Strict Import Conventions</name>
    <description>
      • Always import Node built‑in modules with the node: protocol.
      • Use absolute "#" subpath aliases instead of relative paths.
      • Prefer static imports; avoid dynamic import calls unless absolutely required.
    </description>
    <rationale>
      Clear, deterministic imports boost readability, bundling, and tooling support.
    </rationale>
    <tags>imports,node,static,aliasing</tags>
  </rule>
  <!-- JavaScript BEST PRACTICES -->
  <rule>
    <name>Modern JavaScript Patterns</name>
    <description>
      • Prefer for…of loops or Array map over forEach for iteration.
      • Never use "return await"; return the promise directly.
      • Handle errors consistently by logging and rethrowing them.
      • Use functional style and minimise mutation.
      • Use Object.freeze or Object.seal only when justified and document each use.
      • Avoid argument forwarding and parameter drilling anti‑patterns.
    </description>
    <rationale>
      Promotes predictable behaviour, performance, and maintainability.
    </rationale>
    <tags>javascript,async,errors,functional</tags>
  </rule>
  <!-- TYPESCRIPT BEST PRACTICES -->
  <rule>
    <name>TypeScript Type Safety First</name>
    <description>
      • No implicit any types; if unavoidable, annotate and mute the ESLint rule locally.
      • Avoid unjustified type assertions; rely on generics and explicit return types.
      • Use import type only when importing types and keep type definitions in separate .ts files (verbatimModuleSyntax is on).
      • Prefer type aliases for object shapes and interfaces for contracts or extension.
      • Never rely on non‑null assertions; use optional chaining or nullish coalescing.
    </description>
    <rationale>
      Rigorous typing eliminates entire classes of runtime bugs.
    </rationale>
    <tags>typescript,typesafety,generics,eslint</tags>
  </rule>
  <!-- TESTING -->
  <rule>
    <name>Co‑Locate Unit Tests</name>
    <description>
      Place unit tests next to the code they verify rather than in __tests__ directories. Extend coverage to all edge cases introduced by your change.
    </description>
    <rationale>
      Nearby tests improve discoverability and encourage maintenance.
    </rationale>
    <tags>testing,unit-tests,structure</tags>
  </rule>
  <!-- PURE & SIDE EFFECTS -->
  <rule>
    <name>Pure Functions & Documented Side‑Effects</name>
    <description>
      Functions should be pure by default. When external mutation or I O is necessary, clearly describe what is modified, why the side effect is required, and any safeguards.
    </description>
    <rationale>
      Transparency around side effects simplifies debugging and parallelisation.
    </rationale>
    <tags>purity,side-effects,documentation</tags>
  </rule>
  <!-- REUSABILITY & PATTERNS -->
  <rule>
    <name>Extract Reusable Utilities</name>
    <description>
      Identify repeated patterns and extract them into shared helpers or modules, but only when genuine duplication exists.
    </description>
    <rationale>
      Controlled reuse reduces bugs without introducing unnecessary layers.
    </rationale>
    <tags>dry,reusability,utilities</tags>
  </rule>
  <rule>
    <name>Remove Unused Variables and Imports</name>
    <description>
      • If a variable or module are never used (and not imported for side effects), it must be fully removed rather than prefixed with an underscore or otherwise muted.
    </description>
    <rationale>
      Removing unused variables and imports eliminates dead code, prevents unnecessary dependencies from accumulating, and keeps the codebase clean.
    </rationale>
    <tags>imports,cleanup,lint</tags>
  </rule>
  <rule>
    <name>Document Disable Directives</name>
    <description>
      • Any disable directive (e.g. // eslint-disable-next-line, // eslint-disable, // @ts-ignore) 
        must be immediately preceded by a comment explaining why it is necessary and what issue it addresses.
    </description>
    <rationale>
      Requiring explanations for disable directives preserves code clarity, prevents misuse of lint/type suppressions,
      and ensures accountability during code reviews.
    </rationale>
    <tags>lint,comments,eslint,typescript</tags>
  </rule>
  <rule>
    <name>Full-File Reads for AI Tools</name>
    <description>
      • GitHub Copilot must always request and process the entire file in a single range (e.g. lines 1–10001) rather than splitting it into multiple smaller chunks.
    </description>
    <rationale>
      Reading files in one continuous block preserves full context, prevents missing cross-chunk references, and ensures AI suggestions remain accurate and coherent.
    </rationale>
    <tags>copilot,ai,context,files</tags>
  </rule>
  <rule>
    <name>Single Responsibility Principle</name>
    <description>
      • Every function or module must have one clear responsibility.  
      • If a function grows too complex, split it into smaller, focused functions (e.g. separate merge handlers for each main configuration section).
    </description>
    <rationale>
      Limiting each unit's scope improves readability, testability, and maintainability by ensuring that changes affect only one aspect of behavior.
    </rationale>
    <tags>srp,modularity,responsibility</tags>
  </rule>
  <rule>
    <name>Disallow Unnecessary Type Assertions</name>
    <description>
      • Direct type assertions (e.g. `value as number`) are prohibited unless absolutely unavoidable.  
      • If an assertion cannot be removed, it must be immediately preceded by a comment that explains:
        – Why the assertion is necessary.  
        – What strategies were attempted to eliminate it (e.g. refining type definitions, adjusting generics).  
        – References to any proof or evidence showing the assertion cannot be removed.
    </description>
    <rationale>
      Type assertions bypass the compiler's safety checks and can hide deeper design or typing issues. Requiring justification and proof ensures assertions remain a last resort and encourages robust, maintainable typings.
    </rationale>
    <tags>typescript,typesafety,lint,comments</tags>
  </rule>
  <rule>
    <name>Avoid Parameter Drilling</name>
    <description>
      • Functions must declare and accept only the parameters they actually use.  
      • Do not forward unused parameters through intermediate calls.  
      • When multiple layers need shared data (e.g. flags, config, logger), encapsulate them in a single context or use dependency injection rather than drilling each value.
    </description>
    <rationale>
      Prevents bloated function signatures, reduces cognitive load, and improves decoupling by ensuring each function's API reflects only its true dependencies.
    </rationale>
    <tags>functions,design,api,clean-code</tags>
  </rule>
  <rule>
    <name>Avoid Redundant Directory Name Prefixes</name>
    <description>
      • Do not repeat the parent directory's name as a file prefix (e.g. `utils/utils-helpers.ts` → `utils/helpers.ts`).  
      • For module entry points, prefer generic names like `index.ts`, `main.ts`, or `entry.ts` rather than duplicating the directory name.
    </description>
    <rationale>
      Removing redundant prefixes shortens file paths, enhances discoverability, and prevents unnecessary repetition in project structure.
    </rationale>
    <tags>filesystem,naming,structure</tags>
  </rule>
  <rule>
    <name>Use Proper Encapsulation, Not Underscore Prefixes</name>
    <description>
      • Never use a leading underscore (e.g. `_foo`) to signal private functions, methods, or properties.  
      • Enforce visibility via language-level constructs (e.g. `private`/`protected` keywords), module scope, closures, or explicit access modifiers.  
      • When designing APIs, clearly separate public and private surfaces using exports or interface definitions rather than naming conventions.
    </description>
    <rationale>
      Relying on underscores is a soft convention that offers no compile-time or runtime guarantees. Proper encapsulation through access modifiers and module boundaries ensures enforceable visibility rules, clearer APIs, and safer refactoring.
    </rationale>
    <tags>encapsulation,access-control,naming,typescript,javascript</tags>
  </rule>
  <rule>
    <name>Sync Documentation with Code Changes</name>
    <description>
      • For every edited code file, locate the nearest parent `README.md` in its directory tree.  
      • If changes introduce or alter any crucial, architecture-impacting behavior, update that `README.md` to reflect the new design or usage.  
      • Finally, verify all modified `README.md` remain accurate and consistent with the current codebase.
    </description>
    <rationale>
      Keeping documentation in lockstep with code changes prevents drift, preserves architectural clarity, and improves onboarding for future contributors.
    </rationale>
    <tags>documentation,docs,consistency,architecture,maintainability</tags>
  </rule>
</rules>