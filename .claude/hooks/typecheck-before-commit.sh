#!/usr/bin/env bash
# PreToolUse(Bash): block `git commit` when the workspace does not typecheck.
cmd=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command??"")}catch{}})')
case "$cmd" in *"git commit"*) ;; *) exit 0 ;; esac
cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
if ! out=$(pnpm typecheck 2>&1); then
  echo "Typecheck failed, commit blocked:" >&2
  echo "$out" | tail -30 >&2
  exit 2
fi
exit 0
