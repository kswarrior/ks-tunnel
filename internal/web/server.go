package web

import (
	"context"
	"embed"
	"encoding/json"
	"io/fs"
	"net/http"

	"github.com/username/kstunnel/internal/orchestrator"
	"github.com/username/kstunnel/internal/tunnel"
)

type Server struct {
	orch   *orchestrator.Orchestrator
	static embed.FS
}

func NewServer(orch *orchestrator.Orchestrator, static embed.FS) *Server {
	return &Server{orch: orch, static: static}
}

func (s *Server) Router() *http.ServeMux {
	mux := http.NewServeMux()

	staticFS, _ := fs.Sub(s.static, "ui/static")
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	mux.HandleFunc("/api/tunnels", s.handleTunnels)
	mux.HandleFunc("/api/tunnels/start", s.handleStartTunnel)
	mux.HandleFunc("/api/tunnels/stop", s.handleStopTunnel)
	mux.HandleFunc("/api/tunnels/restart", s.handleRestartTunnel)
	mux.HandleFunc("/api/tunnels/delete", s.handleDeleteTunnel)
	mux.HandleFunc("/api/tunnels/logs", s.handleLogs)
	mux.HandleFunc("/api/providers", s.handleProviders)
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
			ID        string            `json:"id"`
			Name      string            `json:"name"`
			Type      string            `json:"type"`
			LocalAddr string            `json:"local_addr"`
			Token     string            `json:"token"`
			Config    map[string]string `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		id := req.ID
		isUpdate := id != ""
		if id == "" {
			id = req.Name // Use name as ID for new tunnels if not provided
		}

		var provider tunnel.TunnelProvider
		if req.Type == "ngrok" {
			provider = tunnel.NewNgrokProvider(id, req.Name, req.LocalAddr, req.Token)
		} else if req.Type == "cloudflare" {
			provider = tunnel.NewCloudflareProvider(id, req.Name, req.LocalAddr)
		} else {
			// Check if it's a custom provider
			pDef, ok := s.orch.GetProvider(req.Type)
			if !ok {
				http.Error(w, "invalid provider type", http.StatusBadRequest)
				return
			}
			provider = tunnel.NewGenericProvider(id, req.Name, req.Type, pDef.Command, req.Config)
		}

		if isUpdate {
			if err := s.orch.UpdateTunnel(id, provider); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		} else {
			if err := s.orch.AddTunnel(provider); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		// Always try to start (or restart) after create/edit
		if err := s.orch.StartTunnel(context.Background(), id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleStartTunnel(w http.ResponseWriter, r *http.Request) {
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
	if err := s.orch.StartTunnel(context.Background(), req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
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

func (s *Server) handleRestartTunnel(w http.ResponseWriter, r *http.Request) {
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
	if err := s.orch.RestartTunnel(context.Background(), req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleDeleteTunnel(w http.ResponseWriter, r *http.Request) {
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
	if err := s.orch.DeleteTunnel(req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleProviders(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(s.orch.ListProviders())
	case http.MethodPost:
		var def orchestrator.ProviderDef
		if err := json.NewDecoder(r.Body).Decode(&def); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		s.orch.AddProvider(def)
		w.WriteHeader(http.StatusCreated)
	case http.MethodDelete:
		name := r.URL.Query().Get("name")
		if name == "" {
			http.Error(w, "missing name", http.StatusBadRequest)
			return
		}
		s.orch.DeleteProvider(name)
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	logs, err := s.orch.GetLogs(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(logs)
}
