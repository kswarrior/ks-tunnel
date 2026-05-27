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

func (m *mockProvider) GetLogs() []string {
	return []string{"mock log"}
}

func TestOrchestrator(t *testing.T) {
	orch := NewOrchestrator()
	provider := &mockProvider{
		id: "test-1",
		status: tunnel.TunnelInfo{
			ID:     "test-1",
			Name:   "Test Tunnel",
			Type:   "mock",
			Status: tunnel.StatusStopped,
		},
	}

	err := orch.AddTunnel(provider)
	if err != nil {
		t.Fatalf("Failed to add tunnel: %v", err)
	}

	ctx := context.Background()
	err = orch.StartTunnel(ctx, "test-1")
	if err != nil {
		t.Fatalf("Failed to start tunnel: %v", err)
	}

	tunnels := orch.ListTunnels()
	if len(tunnels) != 1 {
		t.Errorf("Expected 1 tunnel, got %d", len(tunnels))
	}

	if tunnels[0].Status != tunnel.StatusRunning {
		t.Errorf("Expected tunnel status RUNNING, got %s", tunnels[0].Status)
	}

	err = orch.StopTunnel("test-1")
	if err != nil {
		t.Fatalf("Failed to stop tunnel: %v", err)
	}

	tunnels = orch.ListTunnels()
	if len(tunnels) != 1 {
		t.Errorf("Expected 1 tunnel after stop, got %d", len(tunnels))
	}
	if tunnels[0].Status != tunnel.StatusStopped {
		t.Errorf("Expected tunnel status STOPPED, got %s", tunnels[0].Status)
	}

	err = orch.DeleteTunnel("test-1")
	if err != nil {
		t.Fatalf("Failed to delete tunnel: %v", err)
	}
	tunnels = orch.ListTunnels()
	if len(tunnels) != 0 {
		t.Errorf("Expected 0 tunnels after delete, got %d", len(tunnels))
	}
}
