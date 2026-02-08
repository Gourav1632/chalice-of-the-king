#!/bin/bash
# Deployment script for Chalice of the King
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e  # Exit on error

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying Chalice of the King to $ENVIRONMENT..."

cd "$PROJECT_ROOT"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose is not installed"
    exit 1
fi

# Pull latest changes (if in git repo)
if [ -d .git ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main || echo "⚠️  Not in a git repository or pull failed"
fi

# Select compose file based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.dev.yml"
fi

# Pull latest images
echo "🐳 Pulling Docker images..."
docker-compose -f "$COMPOSE_FILE" pull

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" down

# Start services
echo "▶️  Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🏥 Checking application health..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Application is healthy!"
else
    echo "⚠️  Health check failed, checking logs..."
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

# Show status
echo ""
echo "📊 Service Status:"
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "✅ Deployment complete!"
echo "🌐 Application available at: http://localhost"
echo "📋 View logs: docker-compose -f $COMPOSE_FILE logs -f"
