#!/bin/bash

# Test launch script for WordPress Author MCP Server

echo "WordPress Author MCP Server - Test Launcher"
echo "=========================================="
echo ""
echo "Select a personality to test:"
echo "1) Contributor (limited tools)"
echo "2) Author (content creation + publishing)"
echo "3) Administrator (full access)"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "Launching with Contributor personality..."
        node src/server.js --personality=contributor
        ;;
    2)
        echo "Launching with Author personality..."
        node src/server.js --personality=author
        ;;
    3)
        echo "Launching with Administrator personality..."
        node src/server.js --personality=administrator
        ;;
    *)
        echo "Invalid choice. Defaulting to Contributor..."
        node src/server.js --personality=contributor
        ;;
esac