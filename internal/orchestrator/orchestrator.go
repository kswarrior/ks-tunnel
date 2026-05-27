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

func (o *Orchestrator) AddTunnel(provider tunnel.TunnelProvider) error {
	info := provider.Status()
	o.mu.Lock()
	defer o.mu.Unlock()
	if _, exists := o.tunnels[info.ID]; exists {
		return fmt.Errorf("tunnel with ID %s already exists", info.ID)
	}
	o.tunnels[info.ID] = provider
	return nil
}

func (o *Orchestrator) UpdateTunnel(id string, provider tunnel.TunnelProvider) error {
	o.mu.Lock()
	old, exists := o.tunnels[id]
	if !exists {
		o.mu.Unlock()
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	// Stop the old one if it's running
	if old.Status().Status == tunnel.StatusRunning {
		old.Stop()
	}

	o.tunnels[id] = provider
	o.mu.Unlock()
	return nil
}

func (o *Orchestrator) StartTunnel(ctx context.Context, id string) error {
	o.mu.RLock()
	provider, exists := o.tunnels[id]
	o.mu.RUnlock()

	if !exists {
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	return provider.Start(ctx)
}

func (o *Orchestrator) StopTunnel(id string) error {
	o.mu.RLock()
	provider, exists := o.tunnels[id]
	o.mu.RUnlock()

	if !exists {
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	return provider.Stop()
}

func (o *Orchestrator) DeleteTunnel(id string) error {
	o.mu.Lock()
	provider, exists := o.tunnels[id]
	if !exists {
		o.mu.Unlock()
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	if provider.Status().Status == tunnel.StatusRunning {
		provider.Stop()
	}
	delete(o.tunnels, id)
	o.mu.Unlock()
	return nil
}

func (o *Orchestrator) RestartTunnel(ctx context.Context, id string) error {
	o.mu.RLock()
	provider, exists := o.tunnels[id]
	o.mu.RUnlock()

	if !exists {
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	provider.Stop()
	return provider.Start(ctx)
}

func (o *Orchestrator) GetLogs(id string) ([]string, error) {
	o.mu.RLock()
	provider, exists := o.tunnels[id]
	o.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("tunnel with ID %s not found", id)
	}
	return provider.GetLogs(), nil
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
	defer o.mu.RUnlock()
	for _, p := range o.tunnels {
		p.Stop()
	}
}
