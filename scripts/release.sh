#!/usr/bin/env bash
# Publishes every workspace package whose version is not on npm yet, then tags it.
#
# Changesets packs with npm, which would ship `catalog:` dependencies unresolved. So Bun packs
# (it writes the real versions into the tarball) and Changesets publishes those tarballs with npm,
# which is what authenticates through npm trusted publishing in CI.
#
# Run through `bun run release`.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
mkdir -p "$out/packages"

cd "$root"
bun changeset publish-plan --output "$out/plan.json"

releases="$(jq -r '.plan | flatten | map(select(.kind == "publish")) | .[].name' "$out/plan.json")"

cp "$out/plan.json" "$out/publish-plan.json"
for name in $releases; do
  dir="$(dirname "$(grep -l "\"name\": \"$name\"" apps/*/package.json)")"
  tarball="$(cd "$dir" && bun pm pack --destination "$out/packages" --quiet)"
  file="packages/$(basename "$tarball")"
  integrity="sha256-$(openssl dgst -sha256 -binary "$out/$file" | openssl base64 -A)"

  jq --arg name "$name" --arg path "$file" --arg integrity "$integrity" \
    '.plan |= map(map(if .name == $name and .kind == "publish" then .tarball = { path: $path, integrity: $integrity } else . end))' \
    "$out/publish-plan.json" > "$out/next.json"
  mv "$out/next.json" "$out/publish-plan.json"
done

# RELEASE_DRY_RUN=1 stops here and shows what would be published.
if [ "${RELEASE_DRY_RUN:-}" = "1" ]; then
  cat "$out/publish-plan.json"
  for tarball in "$out"/packages/*.tgz; do
    [ -e "$tarball" ] || continue
    tar -tzf "$tarball"
    tar -xzOf "$tarball" package/package.json
  done
  exit 0
fi

bun changeset publish --from-pack-dir "$out"
