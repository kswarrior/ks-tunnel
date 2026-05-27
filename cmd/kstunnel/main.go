package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/username/kstunnel"
	"github.com/username/kstunnel/internal/orchestrator"
	"github.com/username/kstunnel/internal/web"
)

func main() {
	port := flag.Int("core_port", 8080, "Port for the Web UI and API")
	flag.Parse()

	orch := orchestrator.NewOrchestrator()
	server := web.NewServer(orch, kstunnel.StaticFiles)

	addr := fmt.Sprintf(":%d", *port)
	fmt.Printf("KS Tunnel starting on http://localhost%s\n", addr)

	go func() {
		if err := http.ListenAndServe(addr, server.Router()); err != nil {
			log.Fatalf("failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	<-stop
	fmt.Println("\nShutting down KS Tunnel...")
	orch.StopAll()
}
