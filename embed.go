package kstunnel

import "embed"

//go:embed ui/static/*
var StaticFiles embed.FS
