#!/usr/bin/env bash
# -e Exit immediately if a command exits with a non-zero status
# -v Print shell input lines as they are read
set -ev

# To prevent changes during build
git checkout package-lock.json

# Install dependencies
npm ci

# Build Notebook
npm run build
