#!/bin/zsh
# Print all lint issues in a readable format, or only for a specific rule if -t <ruleId> is provided
if [[ "$1" == "-t" && -n "$2" ]]; then
  rule="$2"
  npm run -s lint -- --format json | jq -r --arg rule "$rule" '.[] | .filePath as $f | .messages[] | select(.ruleId == $rule) | select(.line != null) | "\($f):\(.line)\n → \(.message)\n"'
else
  npm run -s lint -- --format json | jq -r '.[] | .filePath as $f | .messages[] | select(.line != null) | "\($f):\(.line)\n → \(.message)\n"'
fi
