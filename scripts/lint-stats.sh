#!/bin/zsh
# Print a sorted count of all ESLint rule violations
npm run -s lint -- --format json | jq -r '.[] | .messages[]?.ruleId' | sort | uniq -c | sort -nr
