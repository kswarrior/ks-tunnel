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

func (p *NgrokProvider) Start(ctx context.Context) error {
	p.mu.Lock()
	p.status = StatusStarting
	p.mu.Unlock()

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
		return err
	}

	p.mu.Lock()
	p.tunnel = tun
	p.publicURL = tun.URL()
	p.status = StatusRunning
	p.mu.Unlock()

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
	dest, err := net.Dial("tcp", p.localAddr)
	if err != nil {
		fmt.Printf("failed to dial local addr %s: %v\n", p.localAddr, err)
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
		return err
	}
	return nil
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
	}
}
