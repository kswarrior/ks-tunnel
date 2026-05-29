package tunnel

import (
	"context"
	"fmt"
	"io"
	"net"
	"sync"

	"golang.ngrok.com/ngrok"
	"golang.ngrok.com/ngrok/config"
)

type NgrokProvider struct {
	id        string
	name      string
	localAddr string
	token     string
	session   ngrok.Session
	tunnel    ngrok.Tunnel
	status    Status
	publicURL string
	err       error
	logs      []string
	mu        sync.RWMutex
}

func NewNgrokProvider(id, name, localAddr, token string) *NgrokProvider {
	return &NgrokProvider{
		id:        id,
		name:      name,
		localAddr: localAddr,
		token:     token,
		status:    StatusStopped,
	}
}

func (p *NgrokProvider) addLog(msg string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.logs = append(p.logs, msg)
	if len(p.logs) > 100 {
		p.logs = p.logs[1:]
	}
}

func (p *NgrokProvider) Start(ctx context.Context) error {
	p.mu.Lock()
	p.status = StatusStarting
	p.mu.Unlock()
	p.addLog("Connecting to Ngrok...")

	opts := []ngrok.ConnectOption{
		ngrok.WithAuthtoken(p.token),
	}

	tun, err := ngrok.Listen(ctx,
		config.HTTPEndpoint(),
		opts...,
	)
	if err != nil {
		p.mu.Lock()
		p.status = StatusError
		p.err = err
		p.mu.Unlock()
		p.addLog(fmt.Sprintf("Ngrok connection error: %v", err))
		return err
	}

	p.mu.Lock()
	p.tunnel = tun
	p.publicURL = tun.URL()
	p.status = StatusRunning
	p.mu.Unlock()
	p.addLog(fmt.Sprintf("Ngrok tunnel established at %s", p.publicURL))

	go p.forward(tun)

	return nil
}

func (p *NgrokProvider) forward(tun ngrok.Tunnel) {
	for {
		conn, err := tun.Accept()
		if err != nil {
			p.mu.Lock()
			if p.status == StatusRunning {
				p.status = StatusError
				p.err = err
			}
			p.mu.Unlock()
			return
		}

		go p.handleConn(conn)
	}
}

func (p *NgrokProvider) handleConn(conn net.Conn) {
	defer conn.Close()
	p.addLog(fmt.Sprintf("Forwarding connection from %s", conn.RemoteAddr()))

	localAddr := p.localAddr
	if _, _, err := net.SplitHostPort(localAddr); err != nil {
		localAddr = "localhost:" + localAddr
	}

	dest, err := net.Dial("tcp", localAddr)
	if err != nil {
		p.addLog(fmt.Sprintf("Failed to dial local addr %s: %v", p.localAddr, err))
		return
	}
	defer dest.Close()

	done := make(chan struct{}, 2)
	go func() {
		io.Copy(dest, conn)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(conn, dest)
		done <- struct{}{}
	}()
	<-done
}

func (p *NgrokProvider) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.tunnel != nil {
		err := p.tunnel.Close()
		p.status = StatusStopped
		p.logs = append(p.logs, "Tunnel stopped.")
		return err
	}
	return nil
}

func (p *NgrokProvider) GetLogs() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	logs := make([]string, len(p.logs))
	copy(logs, p.logs)
	return logs
}

func (p *NgrokProvider) Status() TunnelInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	errStr := ""
	if p.err != nil {
		errStr = p.err.Error()
	}

	return TunnelInfo{
		ID:        p.id,
		Name:      p.name,
		Type:      "ngrok",
		LocalAddr: p.localAddr,
		PublicURL: p.publicURL,
		Status:    p.status,
		Error:     errStr,
		Config: map[string]string{
			"Port":  p.localAddr,
			"Token": p.token,
		},
	}
}
