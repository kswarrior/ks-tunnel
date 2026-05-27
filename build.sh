#!/bin/bash
set -e

echo "Building KS Tunnel..."

# Ensure dependencies are up to date
go mod tidy

# Build the binary
go build -o kstunnel ./cmd/kstunnel

echo "Build complete! You can now run ./kstunnel --core_port 8080"
