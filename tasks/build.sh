#!/usr/bin/env bash
# -e Exit immediately if a command exits with a non-zero status
# -v Print shell input lines as they are read
set -ev

# Clean dist and package folder
rm -rf dist && mkdir dist

# To prevent changes during build
git checkout package-lock.json

# Copy package files
cp -r package*.json dist/

# Install production dependencies
npm ci --production --prefix dist

# Copy over rest of the code the will be part of the docker image
cp -r src config dist/
