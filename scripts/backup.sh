#!/bin/bash
# Backup script for Redis data
# Usage: ./scripts/backup.sh [backup-name]

set -e

BACKUP_NAME=${1:-backup-$(date +%Y%m%d-%H%M%S)}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "💾 Starting Redis backup: $BACKUP_NAME"

cd "$PROJECT_ROOT"

# Trigger Redis save
echo "📸 Triggering Redis SAVE command..."
docker-compose exec -T redis redis-cli SAVE

# Copy backup file
echo "📦 Copying backup file..."
docker cp chalice-redis:/data/dump.rdb "$BACKUP_DIR/dump-$BACKUP_NAME.rdb"

# Also backup appendonly file if it exists
if docker exec chalice-redis test -f /data/appendonly.aof 2>/dev/null; then
    echo "📦 Copying AOF file..."
    docker cp chalice-redis:/data/appendonly.aof "$BACKUP_DIR/appendonly-$BACKUP_NAME.aof"
fi

# Compress backup
echo "🗜️  Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" dump-$BACKUP_NAME.rdb appendonly-$BACKUP_NAME.aof 2>/dev/null || \
    tar -czf "$BACKUP_NAME.tar.gz" dump-$BACKUP_NAME.rdb

# Remove uncompressed files
rm -f dump-$BACKUP_NAME.rdb appendonly-$BACKUP_NAME.aof

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)

echo "✅ Backup complete!"
echo "📁 Location: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "📊 Size: $BACKUP_SIZE"

# List recent backups
echo ""
echo "📋 Recent backups:"
ls -lht "$BACKUP_DIR" | head -n 6
