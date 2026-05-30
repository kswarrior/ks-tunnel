package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"

	"github.com/elite-architect/kstunnel/internal/tunnel"
)

var varRegex = regexp.MustCompile(`\$\{([a-zA-Z0-9_]+)\}`)

type VariableOption struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type VariableDef struct {
	Name         string           `json:"name"`
	Type         string           `json:"type"` // "input" or "select"
	ID           string           `json:"id"`
	DefaultValue string           `json:"default_value"`
	Options      []VariableOption `json:"options,omitempty"`
}

type ProviderDef struct {
	Name         string        `json:"name"`
	Type         string        `json:"type"`
	Command      string        `json:"command"`
	Variables    []VariableDef `json:"variables"`
	Regex        string        `json:"regex"`
	CheckCmd     string        `json:"check_cmd"`
	InstallCmd   string        `json:"install_cmd"`
}

type Orchestrator struct {
	tunnels   map[string]tunnel.TunnelProvider
	providers map[string]ProviderDef
	mu        sync.RWMutex
	filePath  string
}

func NewOrchestrator() *Orchestrator {
	o := &Orchestrator{
		tunnels:   make(map[string]tunnel.TunnelProvider),
		providers: make(map[string]ProviderDef),
	}
	o.seedDefaultProviders()
	return o
}

func (o *Orchestrator) seedDefaultProviders() {
	o.SeedNgrok()
	defaults := []ProviderDef{
		{
			Name:       "Cloudflare (Quick)",
			Type:       "Built-in Engine",
			Command:    "cloudflared tunnel --url http://localhost:${Port}",
			CheckCmd:   "which cloudflared",
			InstallCmd: "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared && mv cloudflared /usr/local/bin/",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
			},
			Regex: `https://[a-zA-Z0-9-]+\.trycloudflare\.com`,
		},
		{
			Name:    "Cloudflare (Managed)",
			Type:    "Built-in Engine",
			Command: "cloudflared tunnel run --token ${Token}",
			Variables: []VariableDef{
				{Name: "Token", ID: "Token", Type: "input"},
			},
		},
		{
			Name:       "Localtunnel",
			Type:       "Built-in Engine",
			Command:    "lt --port ${Port} --subdomain ${Subdomain}",
			CheckCmd:   "which lt",
			InstallCmd: "npm install -g localtunnel",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Subdomain", ID: "Subdomain", Type: "input", DefaultValue: ""},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.(loca\.lt|localtunnel\.me)`,
		},
		{
			Name:    "Bore",
			Type:    "Built-in Engine",
			Command: "bore local ${Port} --to bore.pub --secret ${Secret} --id ${ID}",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Secret", ID: "Secret", Type: "input"},
				{Name: "ID", ID: "ID", Type: "input"},
			},
			Regex: `bore.pub:[0-9]+`,
		},
		{
			Name:    "Loophole",
			Type:    "Built-in Engine",
			Command: "loophole http ${Port} --hostname ${Subdomain} --token ${Token}",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Subdomain", ID: "Subdomain", Type: "input"},
				{Name: "Token", ID: "Token", Type: "input"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.loophole\.site`,
		},
		{
			Name:    "Serveo",
			Type:    "Built-in Engine",
			Command: "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -R ${Subdomain}:80:localhost:${Port} serveo.net",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Subdomain", ID: "Subdomain", Type: "input"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.serveo\.net`,
		},
		{
			Name:    "Pinggy.io",
			Type:    "Built-in Engine",
			Command: "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 443 -R0:localhost:${Port}+${Protocol}@ssh.pinggy.io ${Token}",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Protocol", ID: "Protocol", Type: "select", DefaultValue: "http", Options: []VariableOption{{Name: "HTTP", Value: "http"}, {Name: "TCP", Value: "tcp"}}},
				{Name: "Token", ID: "Token", Type: "input"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.pinggy\.link`,
		},
		{
			Name:    "Playit.gg",
			Type:    "Built-in Engine",
			Command: "playit",
			Regex:   `[a-zA-Z0-9.-]+\.playit\.gg`,
		},
		{
			Name:       "Zrok",
			Type:       "Built-in Engine",
			Command:    "zrok share public http://localhost:${Port}",
			Variables:  []VariableDef{{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"}},
			Regex:      `https?://[a-zA-Z0-9-]+\.share\.zrok\.io`,
			CheckCmd:   "zrok version",
			InstallCmd: "curl -sSL https://get.openziti.io/install.sh | bash",
		},
		{
			Name:    "Localhost.run",
			Type:    "Built-in Engine",
			Command: "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -R 80:localhost:${Port} nokey@localhost.run",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.lhr\.life`,
		},
		{
			Name:       "Telebit",
			Type:       "Built-in Engine",
			Command:    "telebit http ${Port}",
			Variables:  []VariableDef{{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"}},
			CheckCmd:   "telebit version",
			InstallCmd: "curl -sSL https://get.telebit.io | bash",
		},
		{
			Name:      "Localhost.run (Legacy)",
			Type:      "Built-in Engine",
			Command:   "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -R 80:localhost:${Port} localhost.run",
			Variables: []VariableDef{{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"}},
			Regex:     `https?://[a-zA-Z0-9-]+\.localhost\.run`,
		},
		{
			Name:    "Localtonet",
			Type:    "Built-in Engine",
			Command: "localtonet authtoken ${Token} && localtonet ${Protocol} --port ${Port}",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Token", ID: "Token", Type: "input"},
				{Name: "Protocol", ID: "Protocol", Type: "select", DefaultValue: "http", Options: []VariableOption{{Name: "HTTP", Value: "http"}, {Name: "TCP", Value: "tcp"}}},
			},
		},
		{
			Name:    "Ssh.run",
			Type:    "Built-in Engine",
			Command: "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -R 80:localhost:${Port} ssh.run",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
			},
			Regex: `https?://[a-zA-Z0-9-]+\.ssh\.run`,
		},
		{
			Name:    "Cloudflare (Client)",
			Type:    "Built-in Engine",
			Command: "cloudflared tunnel run ${Name}",
			Variables: []VariableDef{
				{Name: "Tunnel Name/ID", ID: "Name", Type: "input"},
			},
		},
		{
			Name:    "SocketXP",
			Type:    "Built-in Engine",
			Command: "socketxp connect http://localhost:${Port} --authtoken ${Token}",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Token", ID: "Token", Type: "input"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.socketxp\.com`,
		},
		{
			Name:    "Tunnelin",
			Type:    "Built-in Engine",
			Command: "tunnelin --port ${Port} --token ${Token}",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
				{Name: "Token", ID: "Token", Type: "input"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.tunnelin\.com`,
		},
		{
			Name:    "Pinggy (Quick)",
			Type:    "Built-in Engine",
			Command: "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 443 -R0:localhost:${Port} a.pinggy.io",
			Variables: []VariableDef{
				{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
			},
			Regex: `https?://[a-zA-Z0-9.-]+\.pinggy\.link`,
		},
	}

	for _, p := range defaults {
		o.AddProvider(p)
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
	o.saveUnlocked()
	return nil
}

func (o *Orchestrator) UpdateTunnel(id string, provider tunnel.TunnelProvider) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	old, exists := o.tunnels[id]
	if !exists {
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	// Stop the old one if it's running
	if old.Status().Status == tunnel.StatusRunning {
		old.Stop()
	}

	o.tunnels[id] = provider
	o.saveUnlocked()
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
	defer o.mu.Unlock()
	provider, exists := o.tunnels[id]
	if !exists {
		return fmt.Errorf("tunnel with ID %s not found", id)
	}

	if provider.Status().Status == tunnel.StatusRunning {
		provider.Stop()
	}
	delete(o.tunnels, id)
	o.saveUnlocked()
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
	Total     int `json:"total"`
	Running   int `json:"running"`
	Starting  int `json:"starting"`
	Error     int `json:"error"`
	Stopped   int `json:"stopped"`
	Providers int `json:"providers"`
}

func (o *Orchestrator) GetStats() Stats {
	o.mu.RLock()
	defer o.mu.RUnlock()

	var s Stats
	s.Total = len(o.tunnels)
	s.Providers = len(o.providers)
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

func (o *Orchestrator) AddProvider(def ProviderDef) {
	o.mu.Lock()
	defer o.mu.Unlock()

	// If no variables defined explicitly, try to auto-extract from command
	if len(def.Variables) == 0 {
		matches := varRegex.FindAllStringSubmatch(def.Command, -1)
		vars := make(map[string]bool)
		for _, m := range matches {
			vars[m[1]] = true
		}
		for v := range vars {
			def.Variables = append(def.Variables, VariableDef{
				Name: v,
				ID:   v,
				Type: "input",
			})
		}
	}

	o.providers[def.Name] = def
	o.saveUnlocked()
}

func (o *Orchestrator) SeedNgrok() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.providers["Ngrok"] = ProviderDef{
		Name: "Ngrok",
		Type: "Built-in Engine",
		Variables: []VariableDef{
			{Name: "Port", ID: "Port", Type: "input", DefaultValue: "8080"},
			{Name: "Token", ID: "Token", Type: "input"},
			{Name: "Domain", ID: "Domain", Type: "input"},
		},
	}
}

func (o *Orchestrator) GetProvider(name string) (ProviderDef, bool) {
	o.mu.RLock()
	defer o.mu.RUnlock()
	p, ok := o.providers[name]
	return p, ok
}

func (o *Orchestrator) ListProviders() []ProviderDef {
	o.mu.RLock()
	defer o.mu.RUnlock()
	res := make([]ProviderDef, 0, len(o.providers))
	for _, v := range o.providers {
		res = append(res, v)
	}
	return res
}

func (o *Orchestrator) DeleteProvider(name string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	delete(o.providers, name)
	o.saveUnlocked()
}

func (o *Orchestrator) StopAll() {
	o.mu.RLock()
	defer o.mu.RUnlock()
	for _, p := range o.tunnels {
		p.Stop()
	}
}

type ConfigState struct {
	Providers []ProviderDef       `json:"providers"`
	Tunnels   []tunnel.TunnelInfo `json:"tunnels"`
}

func (o *Orchestrator) SetPersistence(path string) {
	o.mu.Lock()
	o.filePath = path
	o.mu.Unlock()
}

func (o *Orchestrator) Save() error {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.saveUnlocked()
}

func (o *Orchestrator) saveUnlocked() error {
	if o.filePath == "" {
		return nil
	}

	var state ConfigState
	for _, p := range o.providers {
		if p.Type != "Built-in Engine" {
			state.Providers = append(state.Providers, p)
		}
	}
	for _, t := range o.tunnels {
		state.Tunnels = append(state.Tunnels, t.Status())
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(o.filePath, data, 0644)
}

func (o *Orchestrator) Load(path string) error {
	o.SetPersistence(path)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var state ConfigState
	if err := json.Unmarshal(data, &state); err != nil {
		return err
	}

	for _, p := range state.Providers {
		o.AddProvider(p)
	}

	for _, t := range state.Tunnels {
		var provider tunnel.TunnelProvider
		if strings.ToLower(t.Type) == "ngrok" {
			provider = tunnel.NewNgrokProvider(t.ID, t.Name, t.Config["Port"], t.Config["Token"], t.Config["Domain"])
		} else {
			pDef, ok := o.GetProvider(t.Type)
			if ok {
				provider = tunnel.NewGenericProvider(t.ID, t.Name, t.Type, pDef.Command, pDef.Regex, pDef.CheckCmd, pDef.InstallCmd, t.Config)
			}
		}
		if provider != nil {
			o.AddTunnel(provider)
			// Don't auto-start on load to prevent chaos, or let user decide?
			// Let's keep them in stopped state for now.
		}
	}
	return nil
}
