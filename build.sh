#!/bin/bash
set -e

echo "Building KS Tunnel..."
go build -o kstunnel cmd/kstunnel/main.go

echo "Build complete! You can now run ./kstunnel --core_port 8080"
