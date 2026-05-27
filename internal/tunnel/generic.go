package tunnel

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"strings"
	"sync"
)

type GenericProvider struct {
	id        string
	name      string
	typeName  string
	cmdStr    string
	variables map[string]string

	status    Status
	publicURL string
	lastError string
	cmd       *exec.Cmd
	logs      []string
	mu        sync.RWMutex
}

func NewGenericProvider(id, name, typeName, cmdStr string, variables map[string]string) *GenericProvider {
	return &GenericProvider{
		id:        id,
		name:      name,
		typeName:  typeName,
		cmdStr:    cmdStr,
		variables: variables,
		status:    StatusStopped,
		logs:      make([]string, 0, 100),
	}
}

func (p *GenericProvider) Start(ctx context.Context) error {
	p.mu.Lock()
	if p.status == StatusRunning || p.status == StatusStarting {
		p.mu.Unlock()
		return nil
	}
	p.status = StatusStarting
	p.publicURL = ""
	p.lastError = ""
	p.mu.Unlock()

	// Interpolate variables
	finalCmd := p.cmdStr
	for k, v := range p.variables {
		finalCmd = strings.ReplaceAll(finalCmd, "${"+k+"}", v)
	}

	p.addLog("Executing: " + finalCmd)

	parts := strings.Fields(finalCmd)
	if len(parts) == 0 {
		p.setError("empty command")
		return fmt.Errorf("empty command")
	}

	cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
	p.cmd = cmd

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		p.setError(err.Error())
		return err
	}

	p.mu.Lock()
	p.status = StatusRunning
	p.mu.Unlock()

	go p.scanLogs(stdout)
	go p.scanLogs(stderr)

	go func() {
		err := cmd.Wait()
		p.mu.Lock()
		p.status = StatusStopped
		if err != nil {
			p.lastError = err.Error()
			p.addLog("Process exited with error: " + err.Error())
		} else {
			p.addLog("Process exited successfully")
		}
		p.mu.Unlock()
	}()

	return nil
}

func (p *GenericProvider) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.cmd != nil && p.cmd.Process != nil {
		return p.cmd.Process.Kill()
	}
	return nil
}

func (p *GenericProvider) Status() TunnelInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Copy variables to config for UI
	config := make(map[string]string)
	for k, v := range p.variables {
		config[k] = v
	}

	return TunnelInfo{
		ID:        p.id,
		Name:      p.name,
		Type:      p.typeName,
		LocalAddr: p.variables["Port"], // Convention
		PublicURL: p.publicURL,
		Status:    p.status,
		Error:     p.lastError,
		Config:    config,
	}
}

func (p *GenericProvider) GetLogs() []string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	res := make([]string, len(p.logs))
	copy(res, p.logs)
	return res
}

func (p *GenericProvider) addLog(line string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.logs) >= 100 {
		p.logs = p.logs[1:]
	}
	p.logs = append(p.logs, line)

	// Attempt to find public URL using common patterns if not found yet
	if p.publicURL == "" {
		re := regexp.MustCompile(`https?://[a-zA-Z0-9.-]+\.(ngrok-free\.app|trycloudflare\.com|loca\.lt)[^\s]*`)
		if found := re.FindString(line); found != "" {
			p.publicURL = found
		}
	}
}

func (p *GenericProvider) scanLogs(r io.ReadCloser) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		p.addLog(scanner.Text())
	}
}

func (p *GenericProvider) setError(msg string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.status = StatusError
	p.lastError = msg
	p.addLog("Error: " + msg)
}

// Minimal io.ReadCloser usage requires "io" import
