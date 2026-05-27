package tunnel

import (
	"bufio"
	"context"
	"os/exec"
	"regexp"
	"strings"
	"sync"
)

type BinaryProvider struct {
	id        string
	name      string
	localAddr string
	cmd       *exec.Cmd
	status    Status
	publicURL string
	err       error
	mu        sync.RWMutex
}

func NewCloudflareProvider(id, name, localAddr string) *BinaryProvider {
	return &BinaryProvider{
		id:        id,
		name:      name,
		localAddr: localAddr,
		status:    StatusStopped,
	}
}

func (p *BinaryProvider) Start(ctx context.Context) error {
	p.mu.Lock()
	p.status = StatusStarting
	p.mu.Unlock()

	// cloudflared tunnel --url http://localhost:8080
	// Use the localAddr. If it doesn't start with http, assume it's http.
	addr := p.localAddr
	if !strings.HasPrefix(addr, "http://") && !strings.HasPrefix(addr, "https://") {
		addr = "http://" + addr
	}

	cmd := exec.CommandContext(ctx, "cloudflared", "tunnel", "--url", addr)
	p.cmd = cmd

	stderr, err := cmd.StderrPipe()
	if err != nil {
		p.mu.Lock()
		p.status = StatusError
		p.err = err
		p.mu.Unlock()
		return err
	}

	if err := cmd.Start(); err != nil {
		p.mu.Lock()
		p.status = StatusError
		p.err = err
		p.mu.Unlock()
		return err
	}

	// Regex to find the quick tunnel URL
	// Usually looks like: https://something-something.trycloudflare.com
	re := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			if p.publicURL == "" {
				if match := re.FindString(line); match != "" {
					p.mu.Lock()
					p.publicURL = match
					p.status = StatusRunning
					p.mu.Unlock()
				}
			}
		}

		err := cmd.Wait()
		p.mu.Lock()
		if p.status != StatusStopped {
			p.status = StatusError
			if err != nil {
				p.err = err
			}
		}
		p.mu.Unlock()
	}()

	return nil
}

func (p *BinaryProvider) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.cmd != nil && p.cmd.Process != nil {
		p.status = StatusStopped
		return p.cmd.Process.Kill()
	}
	return nil
}

func (p *BinaryProvider) Status() TunnelInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	errStr := ""
	if p.err != nil {
		errStr = p.err.Error()
	}

	return TunnelInfo{
		ID:        p.id,
		Name:      p.name,
		Type:      "cloudflare",
		LocalAddr: p.localAddr,
		PublicURL: p.publicURL,
		Status:    p.status,
		Error:     errStr,
	}
}
