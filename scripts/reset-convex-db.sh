#!/usr/bin/env bash
set -euo pipefail

CONFIRM_TOKEN="RESET_ALL_GAMES"
CONVEX_TARGET_DEPLOYMENT="${CONVEX_TARGET_DEPLOYMENT:-${CONVEX_DEPLOYMENT:-}}"
BATCH_SIZE="${BATCH_SIZE:-10}"

TABLES=(
  checkIns
  goals
  buildings
  events
  aiMessages
  gossipConversations
  gossipTurns
  groupRooms
  agents
  islandMembers
  islands
  knotTransactions
  knotSyncCursors
  knotUserBindings
  users
)

if ! [[ "${BATCH_SIZE}" =~ ^[0-9]+$ ]] || [[ "${BATCH_SIZE}" -lt 1 ]]; then
  echo "BATCH_SIZE must be a positive integer."
  exit 1
fi

echo "⚠️  This will permanently delete ALL data from all Convex tables."
if [[ -n "${CONVEX_TARGET_DEPLOYMENT}" ]]; then
  echo "Target deployment override: ${CONVEX_TARGET_DEPLOYMENT}"
else
  echo "Target deployment: current selected Convex project context"
fi
echo
read -r -p "Type ${CONFIRM_TOKEN} to continue: " typed

if [[ "${typed}" != "${CONFIRM_TOKEN}" ]]; then
  echo "Aborted. Confirmation token did not match."
  exit 1
fi

cd "$(dirname "$0")/../apps/app"

push_flag="--push"
total_deleted=0
deployment_arg=()
if [[ -n "${CONVEX_TARGET_DEPLOYMENT}" ]]; then
  deployment_arg=(--deployment "${CONVEX_TARGET_DEPLOYMENT}")
fi

echo
for table in "${TABLES[@]}"; do
  table_deleted=0
  while true; do
    payload="$(printf '{"confirmToken":"%s","tableName":"%s","batchSize":%s}' "${CONFIRM_TOKEN}" "${table}" "${BATCH_SIZE}")"

    if [[ -n "${push_flag}" ]]; then
      if [[ ${#deployment_arg[@]} -gt 0 ]]; then
        raw_output="$(unset CONVEX_DEPLOYMENT; npx convex run admin:resetTableBatch "${payload}" ${push_flag} "${deployment_arg[@]}")"
      else
        raw_output="$(unset CONVEX_DEPLOYMENT; npx convex run admin:resetTableBatch "${payload}" ${push_flag})"
      fi
      push_flag=""
    else
      if [[ ${#deployment_arg[@]} -gt 0 ]]; then
        raw_output="$(unset CONVEX_DEPLOYMENT; npx convex run admin:resetTableBatch "${payload}" "${deployment_arg[@]}")"
      else
        raw_output="$(unset CONVEX_DEPLOYMENT; npx convex run admin:resetTableBatch "${payload}")"
      fi
    fi

    json_block="$(printf '%s\n' "${raw_output}" | sed -n '/^{/,$p')"
    deleted="$(printf '%s' "${json_block}" | jq -r '.deleted' 2>/dev/null || true)"
    done_flag="$(printf '%s' "${json_block}" | jq -r '.done' 2>/dev/null || true)"

    if [[ -z "${deleted}" || -z "${done_flag}" || "${deleted}" == "null" || "${done_flag}" == "null" ]]; then
      echo "Failed parsing Convex output for table ${table}."
      echo "Raw output:"
      printf '%s\n' "${raw_output}"
      exit 1
    fi

    table_deleted=$((table_deleted + deleted))
    total_deleted=$((total_deleted + deleted))

    if [[ "${done_flag}" == "true" ]]; then
      break
    fi
  done

  printf '%-20s %s\n' "${table}:" "${table_deleted} deleted"
done

echo
printf 'Total deleted: %s\n' "${total_deleted}"
