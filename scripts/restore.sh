#!/bin/bash
# Restore script for Redis data
# Usage: ./scripts/restore.sh <backup-file>
# Example: ./scripts/restore.sh backups/backup-20260208-120000.tar.gz

set -e

if [ $# -eq 0 ]; then
    echo "❌ Error: No backup file specified"
    echo "Usage: ./scripts/restore.sh <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1 backups/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMP_DIR=$(mktemp -d)

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will replace current Redis data!"
echo "📦 Backup file: $BACKUP_FILE"
read -p "Continue? (yes/no): " -r
if [ "$REPLY" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

cd "$PROJECT_ROOT"

echo "🛑 Stopping Redis..."
docker-compose stop redis

echo "📦 Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

echo "📥 Copying backup files to Redis container..."
if [ -f "$TEMP_DIR/dump-"*.rdb ]; then
    docker cp "$TEMP_DIR"/dump-*.rdb chalice-redis:/data/dump.rdb
    echo "✅ Restored dump.rdb"
fi

if [ -f "$TEMP_DIR/appendonly-"*.aof ]; then
    docker cp "$TEMP_DIR"/appendonly-*.aof chalice-redis:/data/appendonly.aof
    echo "✅ Restored appendonly.aof"
fi

# Cleanup temp directory
rm -rf "$TEMP_DIR"

echo "▶️  Starting Redis..."
docker-compose start redis

echo "⏳ Waiting for Redis to be ready..."
sleep 5

# Verify Redis is running
if docker-compose exec -T redis redis-cli PING | grep -q PONG; then
    echo "✅ Restore complete! Redis is running."
else
    echo "⚠️  Redis may not be ready yet. Check logs:"
    echo "   docker-compose logs redis"
fi
