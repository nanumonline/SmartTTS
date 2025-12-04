#!/bin/bash
# Pre-build script to remove PHP files from api folder
# This ensures Vercel doesn't see conflicting PHP files

echo "Cleaning PHP files from api folder..."

# Remove all PHP files from api folder
find api -name "*.php" -type f -delete 2>/dev/null || true

# Also try with rm command
find api -name "*.php" -type f -exec rm -f {} \; 2>/dev/null || true

echo "PHP files cleaned from api folder"

