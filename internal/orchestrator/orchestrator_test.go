package orchestrator

import (
	"context"
	"testing"

	"github.com/username/kstunnel/internal/tunnel"
)

type mockProvider struct {
	id     string
	status tunnel.TunnelInfo
}

func (m *mockProvider) Start(ctx context.Context) error {
	m.status.Status = tunnel.StatusRunning
	return nil
}

func (m *mockProvider) Stop() error {
	m.status.Status = tunnel.StatusStopped
	return nil
}

func (m *mockProvider) Status() tunnel.TunnelInfo {
	return m.status
}

func TestOrchestrator(t *testing.T) {
	orch := NewOrchestrator()
	provider := &mockProvider{
		id: "test-1",
		status: tunnel.TunnelInfo{
			ID:   "test-1",
			Name: "Test Tunnel",
			Type: "mock",
		},
	}

	ctx := context.Background()
	err := orch.StartTunnel(ctx, provider)
	if err != nil {
		t.Fatalf("Failed to start tunnel: %v", err)
	}

	tunnels := orch.ListTunnels()
	if len(tunnels) != 1 {
		t.Errorf("Expected 1 tunnel, got %d", len(tunnels))
	}

	if tunnels[0].ID != "test-1" {
		t.Errorf("Expected tunnel ID test-1, got %s", tunnels[0].ID)
	}

	err = orch.StopTunnel("test-1")
	if err != nil {
		t.Fatalf("Failed to stop tunnel: %v", err)
	}

	tunnels = orch.ListTunnels()
	if len(tunnels) != 0 {
		t.Errorf("Expected 0 tunnels, got %d", len(tunnels))
	}
}
