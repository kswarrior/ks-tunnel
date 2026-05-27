package tunnel

import "context"

type Status string

const (
	StatusStarting Status = "STARTING"
	StatusRunning  Status = "RUNNING"
	StatusStopped  Status = "STOPPED"
	StatusError    Status = "ERROR"
)

type TunnelInfo struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"` // e.g., "ngrok", "cloudflare"
	LocalAddr string `json:"local_addr"`
	PublicURL string `json:"public_url"`
	Status    Status `json:"status"`
	Error     string `json:"error,omitempty"`
}

type TunnelProvider interface {
	Start(ctx context.Context) error
	Stop() error
	Status() TunnelInfo
	GetLogs() []string
}
