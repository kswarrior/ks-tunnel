package orchestrator

import (
	"context"
	"fmt"
	"sync"

	"github.com/username/kstunnel/internal/tunnel"
)

type Orchestrator struct {
	tunnels map[string]tunnel.TunnelProvider
	mu      sync.RWMutex
}

func NewOrchestrator() *Orchestrator {
	return &Orchestrator{
		tunnels: make(map[string]tunnel.TunnelProvider),
	}
}

func (o *Orchestrator) StartTunnel(ctx context.Context, provider tunnel.TunnelProvider) error {
	info := provider.Status()

	o.mu.Lock()
	if _, exists := o.tunnels[info.ID]; exists {
		o.mu.Unlock()
		return fmt.Errorf("tunnel with ID %s already exists", info.ID)
	}
	o.tunnels[info.ID] = provider
	o.mu.Unlock()

	return provider.Start(ctx)
}

func (o *Orchestrator) StopTunnel(id string) error {
	o.mu.RLock()
	provider, exists := o.tunnels[id]
	o.mu.RUnlock()

	if !exists {
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	err := provider.Stop()

	o.mu.Lock()
	delete(o.tunnels, id)
	o.mu.Unlock()

	return err
}

func (o *Orchestrator) ListTunnels() []tunnel.TunnelInfo {
	o.mu.RLock()
	defer o.mu.RUnlock()

	infos := make([]tunnel.TunnelInfo, 0, len(o.tunnels))
	for _, p := range o.tunnels {
		infos = append(infos, p.Status())
	}
	return infos
}

type Stats struct {
	Total    int `json:"total"`
	Running  int `json:"running"`
	Starting int `json:"starting"`
	Error    int `json:"error"`
	Stopped  int `json:"stopped"`
}

func (o *Orchestrator) GetStats() Stats {
	o.mu.RLock()
	defer o.mu.RUnlock()

	var s Stats
	s.Total = len(o.tunnels)
	for _, p := range o.tunnels {
		status := p.Status().Status
		switch status {
		case tunnel.StatusRunning:
			s.Running++
		case tunnel.StatusStarting:
			s.Starting++
		case tunnel.StatusError:
			s.Error++
		case tunnel.StatusStopped:
			s.Stopped++
		}
	}
	return s
}

func (o *Orchestrator) StopAll() {
	o.mu.RLock()
	ids := make([]string, 0, len(o.tunnels))
	for id := range o.tunnels {
		ids = append(ids, id)
	}
	o.mu.RUnlock()

	for _, id := range ids {
		o.StopTunnel(id)
	}
}
