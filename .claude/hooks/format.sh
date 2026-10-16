#!/usr/bin/env bash
# PostToolUse(Edit|Write): run Prettier and ESLint --fix on the edited file. Never blocks.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
f=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')
[ -n "$f" ] && [ -f "$f" ] || exit 0
case "$f" in "$PWD"/*) ;; *) exit 0 ;; esac
case "$f" in */node_modules/*) exit 0 ;; esac
case "$f" in
  *.ts | *.tsx | *.js) pnpm exec prettier --write "$f" >/dev/null 2>&1; pnpm exec eslint --fix "$f" >/dev/null 2>&1 ;;
  *.json | *.md | *.yml | *.yaml) pnpm exec prettier --write "$f" >/dev/null 2>&1 ;;
esac
exit 0
