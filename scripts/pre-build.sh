#!/bin/bash
# Pre-build script to remove PHP files from api folder
# This ensures Vercel doesn't see conflicting PHP files

set -e

echo "Cleaning PHP files from api folder..."

# Remove all PHP files from api folder (multiple methods for reliability)
if [ -d "api" ]; then
  # Method 1: find and delete
  find api -name "*.php" -type f -delete 2>/dev/null || true
  
  # Method 2: find and rm
  find api -name "*.php" -type f -exec rm -f {} \; 2>/dev/null || true
  
  # Method 3: specific file removal
  rm -f api/broadcast/*.php 2>/dev/null || true
  rm -f api/broadcasting/*.php 2>/dev/null || true
  
  # Verify removal
  PHP_COUNT=$(find api -name "*.php" -type f 2>/dev/null | wc -l || echo "0")
  if [ "$PHP_COUNT" -gt 0 ]; then
    echo "Warning: $PHP_COUNT PHP files still found in api folder"
    find api -name "*.php" -type f
  else
    echo "✓ All PHP files removed from api folder"
  fi
else
  echo "api folder not found, skipping PHP cleanup"
fi

