#!/bin/bash
set -e

FORK_REPO_URL="https://github.com/arpitjp/muya.git"
FORK_BRANCH="master"
FORK_DIR="libs/muya"
DIST_DIR="dist"

echo "🔍 Checking for submodule..."
if [ ! -d "$FORK_DIR" ]; then
  echo "📦 Cloning forked package..."
  git clone --branch "$FORK_BRANCH" "$FORK_REPO_URL" "$FORK_DIR"
else
  echo "✅ Forked submodule already present. Resetting to latest $FORK_BRANCH..."
  pushd "$FORK_DIR" > /dev/null
  git fetch origin
  git reset --hard "origin/$FORK_BRANCH"
  popd > /dev/null
fi

echo "📦 Packing the forked package..."
mkdir -p "$DIST_DIR"
pushd "$FORK_DIR" > /dev/null
pnpm install

pushd packages/core > /dev/null
pnpm install
npm run build
npm publish --dry-run
PKG_FILE=$(npm pack)
popd > /dev/null
popd > /dev/null

echo "📂 Moving $PKG_FILE to $DIST_DIR/"
rm -f "$DIST_DIR"/muya*.tgz
mv "$FORK_DIR/packages/core/$PKG_FILE" "$DIST_DIR/"

# 🛠 Update dependency in package.json
echo "🔄 Updating muya dependency in package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@muyajs/core'] = 'file:dist/$PKG_FILE';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "✅ Done preparing forked dependency."
