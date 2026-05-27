package web

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/username/kstunnel/internal/orchestrator"
	"github.com/username/kstunnel/internal/tunnel"
)

type Server struct {
	orch *orchestrator.Orchestrator
}

func NewServer(orch *orchestrator.Orchestrator) *Server {
	return &Server{orch: orch}
}

func (s *Server) Router() *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./ui/static")))
	mux.HandleFunc("/api/tunnels", s.handleTunnels)
	mux.HandleFunc("/api/tunnels/stop", s.handleStopTunnel)
	mux.HandleFunc("/api/stats", s.handleStats)
	return mux
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	json.NewEncoder(w).Encode(s.orch.GetStats())
}

func (s *Server) handleTunnels(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		tunnels := s.orch.ListTunnels()
		json.NewEncoder(w).Encode(tunnels)
	case http.MethodPost:
		var req struct {
			Name      string `json:"name"`
			Type      string `json:"type"`
			LocalAddr string `json:"local_addr"`
			Token     string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		id := req.Name // For simplicity, use name as ID or generate one
		var provider tunnel.TunnelProvider
		if req.Type == "ngrok" {
			provider = tunnel.NewNgrokProvider(id, req.Name, req.LocalAddr, req.Token)
		} else if req.Type == "cloudflare" {
			provider = tunnel.NewCloudflareProvider(id, req.Name, req.LocalAddr)
		} else {
			http.Error(w, "invalid provider type", http.StatusBadRequest)
			return
		}

		if err := s.orch.StartTunnel(context.Background(), provider); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleStopTunnel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.orch.StopTunnel(req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
