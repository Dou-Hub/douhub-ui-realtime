set -e
sh run-upgrade.sh
sh run-tsc.sh

npm version patch --no-git-tag-version
sh run-publish.sh