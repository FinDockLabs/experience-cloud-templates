#!/usr/bin/env bash
#
# Build org-dependent unlocked packages for the EXC templates.
#
# Model (one variant per customer org):
#   Each variant package is SELF-CONTAINED — the shared source pool in
#   sfdx-source/shared/ (LWC, Apex, custom labels) is assembled into the variant
#   package directory at build time, then the working tree is restored.
#   sfdx-source/shared/ is kept as a single source copy and is NOT a standalone
#   package. Assembly is a plain copy — never symlinks.
#
# Selective assembly:
#   Each variant declares in <variant>/shared.manifest which of the shared pool
#   it needs. The value decides exactly what gets copied into the package:
#     all   — LWC bundles + Apex classes + SharedLabels.labels-meta.xml
#             (the default when the file is absent)
#     none  — nothing; the package ships only the variant's own metadata
#   Under 'all' the package ends up with two label files: SharedLabels (from the
#   pool) and the variant's own CustomLabels. CustomLabel is deployed one label at
#   a time, so both are read and no merge is needed — but each label must appear
#   in exactly one file, or the deploy fails as a duplicate.
#
# Why org-dependent:
#   FinDock Core (PaymentHub) is currently 1GP — no build-time dependency can be
#   declared on it. Packages are created with --org-dependent: references to Core
#   are validated at install time in the target org (any active Core version).
#
# Requirements: sf CLI, jq, python3 (reads packageAliases in 'create'),
#               an authenticated DevHub, a clean git tree.
#
# Usage:
#   ./scripts/create-package-versions.sh create                        # one-time: create the packages
#   ./scripts/create-package-versions.sh version                       # a beta version for every variant
#   ./scripts/create-package-versions.sh version donation-npsp         # a beta version for one variant
#   ./scripts/create-package-versions.sh version checkout lwc-procode  # ...or several
#
# Every named variant gets a new version, whether or not its source changed, so
# name the ones you touched — the DevHub has a daily version limit.
#
set -euo pipefail

DEVHUB="${DEVHUB:-DevHub}"
SRC_ROOT="sfdx-source"
SHARED="$SRC_ROOT/shared"
PKG_ROOT="$SRC_ROOT/packages"
VARIANTS=(donation-fundraising donation-fundraising-uk donation-npsp checkout lwc-procode)

pkg_name() {
  case "$1" in
    donation-fundraising)    echo "FinDock Experiences - Fundraising" ;;
    donation-fundraising-uk) echo "FinDock Experiences - Fundraising UK" ;;
    donation-npsp)           echo "FinDock Experiences - NPSP" ;;
    checkout)                echo "FinDock Experiences - Checkout" ;;
    lwc-procode)             echo "FinDock Experiences - Pro-code LWC" ;;
  esac
}

# Read a variant's shared.manifest: "all" (default) or "none".
# Comments (#) and blank lines are ignored.
shared_mode() {
  local f="$PKG_ROOT/$1/shared.manifest"
  [ -f "$f" ] || { echo "all"; return; }
  local mode
  mode=$(grep -vE '^\s*(#|$)' "$f" | head -1 | tr -d '[:space:]')
  case "$mode" in
    all|none) echo "$mode" ;;
    "")       echo "all" ;;   # manifest present but empty → default
    *)        echo "INVALID:$mode" ;;
  esac
}

assemble() {
  local v="$1" dir="$PKG_ROOT/$1"
  local mode; mode="$(shared_mode "$v")"

  case "$mode" in
    INVALID:*)
      echo "ERROR: $v/shared.manifest has an unknown value '${mode#INVALID:}' (expected: all | none)"; exit 1 ;;
    none)
      # Copies nothing. The package ships only what the variant directory holds.
      echo "    shared: none" ;;
    all)
      # Copies the whole shared pool: LWC bundles, Apex classes, shared labels.
      mkdir -p "$dir/lwc" "$dir/classes" "$dir/labels"
      cp -R "$SHARED"/lwc/.     "$dir/lwc/"
      cp -R "$SHARED"/classes/. "$dir/classes/"
      # Two label files end up side by side: SharedLabels (from the pool) and the
      # variant's own CustomLabels. CustomLabel is deployed one label at a time, so
      # both containers are read and no merge is needed. Each label must appear in
      # exactly one of the two files, otherwise the deploy fails as a duplicate.
      cp "$SHARED/labels/SharedLabels.labels-meta.xml" "$dir/labels/"
      echo "    shared: all" ;;
  esac
}

restore() {
  # Drop the assembled-in shared source, keeping shared.manifest — it is a build
  # input, not build output.
  git checkout -- "$PKG_ROOT/$1" 2>/dev/null || true
  git clean -fdq -e shared.manifest "$PKG_ROOT/$1" 2>/dev/null || true
}

cmd="${1:-version}"

case "$cmd" in
  create)
    for v in "${VARIANTS[@]}"; do
      name="$(pkg_name "$v")"
      # An alias means the package already exists in the DevHub. Skip it —
      # Salesforce allows duplicate package names, so a second create would add a
      # second container under the same name.
      if python3 -c "import json,sys; sys.exit(0 if '$name' in (json.load(open('sfdx-project.json')).get('packageAliases') or {}) else 1)"; then
        echo ">>> skip (already in packageAliases): $name"
        continue
      fi
      echo ">>> create package: $name ($PKG_ROOT/$v)"
      sf package create --name "$name" --package-type Unlocked --org-dependent \
        --path "$PKG_ROOT/$v" --target-dev-hub "$DEVHUB"
    done
    echo "Done. Check packageAliases in sfdx-project.json."
    ;;

  version)
    if [ -n "$(git status --porcelain "$PKG_ROOT" 2>/dev/null)" ]; then
      echo "ERROR: $PKG_ROOT/ has uncommitted changes. Commit or stash first (build restores the tree)."; exit 1
    fi
    # Versions the variants named as arguments, or all of them when none are given.
    shift || true
    targets=("$@")
    [ ${#targets[@]} -eq 0 ] && targets=("${VARIANTS[@]}")
    for v in "${targets[@]}"; do
      # shellcheck disable=SC2076
      if [[ ! " ${VARIANTS[*]} " =~ " $v " ]]; then
        echo "ERROR: unknown variant '$v'. Known: ${VARIANTS[*]}"; exit 1
      fi
      name="$(pkg_name "$v")"
      echo ">>> assemble + version: $name"
      assemble "$v"
      VERSION_ID=$(sf package version create --package "$name" \
        --installation-key-bypass --code-coverage --wait 60 \
        --target-dev-hub "$DEVHUB" --json | jq -r '.result.SubscriberPackageVersionId')
      restore "$v"
      echo "    SubscriberPackageVersionId: ${VERSION_ID}"
      echo "    Install link (prod/dev): https://login.salesforce.com/packaging/installPackage.apexp?p0=${VERSION_ID}"
      echo "    Install link (sandbox):  https://test.salesforce.com/packaging/installPackage.apexp?p0=${VERSION_ID}"
      echo ""
    done
    echo "Beta versions built. Promote on tag/release:"
    echo "  sf package version promote --package <04t...> --target-dev-hub $DEVHUB --no-prompt"
    ;;

  *)
    echo "Usage: $0 [create|version]"; exit 1;;
esac
