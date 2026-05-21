#!/bin/bash
# Initial EC2 setup script for backend deployment using pre-built images

set -e

echo "🚀 Chalice of the King - Backend EC2 Setup"
echo "=========================================="
echo ""

# Auto-detect EC2 Public IP
echo "Detecting EC2 Public IP..."
EC2_IP=$(curl -s http://checkip.amazonaws.com || curl -s ifconfig.me || echo "localhost")
echo "✓ Detected IP: ${EC2_IP}"
echo ""

# Prompt for credentials
echo "Please provide the following values:"
echo ""

read -p "Enter your GitHub Username (default: gourav1632): " GITHUB_USER
GITHUB_USER=${GITHUB_USER:-gourav1632}
read -s -p "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
echo ""

echo ""

# Create .env file
cat > .env << EOF
# Application Configuration
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# CORS Configuration
FRONTEND_URL=https://chalice-of-the-king.duckdns.org

# Redis Configuration
REDIS_URL=redis://redis:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=1000
RATE_LIMIT_MAX_REQUESTS=5

# WebRTC SFU Configuration (Phase 4)
SFU_PROVIDER=mock
SFU_ROOM_TTL=0

# GitHub Username for pulling images
GITHUB_USER=${GITHUB_USER}
EOF

echo "✅ Created .env file"
echo ""

# Display configuration
echo "📋 Configuration Summary:"
echo "-------------------------"
echo "EC2 IP: ${EC2_IP}"
echo "DuckDNS Domain: chalice-of-the-king.duckdns.org"
echo "Backend API: https://chalice-of-the-king.duckdns.org"
echo ""

# Save credentials (informational)
cat > ~/deployment-credentials.txt << EOF
Chalice of the King - Deployment Credentials
======================================
Generated on: $(date)

EC2 Public IP: ${EC2_IP}
DuckDNS Domain: chalice-of-the-king.duckdns.org

Backend API: https://chalice-of-the-king.duckdns.org

Deploy frontend with:
VITE_BACKEND_URL=https://chalice-of-the-king.duckdns.org

IMPORTANT: Keep this file secure and delete after saving credentials elsewhere!
EOF

chmod 600 ~/deployment-credentials.txt
echo "💾 Credentials saved to: ~/deployment-credentials.txt"
echo "⚠️  IMPORTANT: Save these credentials securely, then delete the file!"
echo ""

# Ask to deploy
read -p "Start deployment now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting deployment..."
    echo ""
    
    # Use backend-only compose
    ln -sf docker-compose.backend.yml docker-compose.yml
    
    # Login to GitHub Container Registry
    echo "🔐 Logging into GitHub Container Registry..."
    echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_USER}" --password-stdin
    
    # Pull images
    echo "📦 Pulling Docker images from GHCR..."
    docker compose pull
    
    # Start services
    echo "▶️  Starting services..."
    docker compose up -d
    
    echo ""
    echo "⏳ Waiting for services to start..."
    sleep 10
    
    # Show status
    echo ""
    echo "📊 Service Status:"
    docker compose ps
    
    echo ""
    echo "📋 Recent Logs:"
    docker compose logs --tail=30
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "🌐 Access your backend:"
    echo "   API Base: https://chalice-of-the-king.duckdns.org"
    echo "   (Initial access: http://${EC2_IP} - will redirect to HTTPS once SSL is active)"
    echo ""
    echo "⚠️  IMPORTANT: Set up DuckDNS domain pointing to ${EC2_IP}"
    echo "   1. Go to https://www.duckdns.org"
    echo "   2. Create subdomain: chalice-of-the-king"
    echo "   3. Point to IP: ${EC2_IP}"
    echo "   4. Caddy will automatically obtain SSL certificate"
    echo ""
    echo "📝 View logs: docker compose logs -f"
    echo "🔄 Restart: docker compose restart"
    echo "🛑 Stop: docker compose down"
    echo ""
else
    echo ""
    echo "Deployment skipped. To deploy manually later:"
    echo "  ln -sf docker-compose.backend.yml docker-compose.yml"
    echo "  echo 'YOUR_TOKEN' | docker login ghcr.io -u '${GITHUB_USER}' --password-stdin"
    echo "  docker compose pull"
    echo "  docker compose up -d"
fi

echo ""
echo "🎉 Setup complete!"
