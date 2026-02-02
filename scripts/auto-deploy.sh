#!/bin/bash
cd /var/www/agency-finance
git fetch

if [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]; then
  echo "New commits found, deploying..."
  ./deploy.sh
else
  echo "No new commits"
fi
