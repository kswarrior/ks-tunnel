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
	cmdStr     string
	checkCmd   string
	installCmd string
	variables  map[string]string
	regex      string
	re         *regexp.Regexp

	status    Status
	publicURL string
	lastError string
	cmd       *exec.Cmd
	logs      []string
	mu        sync.RWMutex
}

func NewGenericProvider(id, name, typeName, cmdStr, regex, checkCmd, installCmd string, variables map[string]string) *GenericProvider {
	var re *regexp.Regexp
	reStr := `https?://[a-zA-Z0-9.-]+\.(ngrok-free\.app|trycloudflare\.com|loca\.lt)[^\s]*`
	if regex != "" {
		reStr = regex
	}
	re, _ = regexp.Compile(reStr)

	return &GenericProvider{
		id:         id,
		name:       name,
		typeName:   typeName,
		cmdStr:     cmdStr,
		checkCmd:   checkCmd,
		installCmd: installCmd,
		regex:      regex,
		re:         re,
		variables:  variables,
		status:     StatusStopped,
		logs:       make([]string, 0, 100),
	}
}

func (p *GenericProvider) interpolate(cmd string) string {
	for k, v := range p.variables {
		cmd = strings.ReplaceAll(cmd, "${"+k+"}", v)
	}
	return cmd
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

	// Install on demand if commands are provided
	if p.checkCmd != "" && p.installCmd != "" {
		checkCmd := p.interpolate(p.checkCmd)
		p.addLog("Checking if software is installed: " + checkCmd)
		checkParts := strings.Fields(checkCmd)
		if err := exec.Command(checkParts[0], checkParts[1:]...).Run(); err != nil {
			p.addLog("Software not found. Installing...")
			installCmd := p.interpolate(p.installCmd)
			installParts := strings.Fields(installCmd)
			if out, err := exec.Command(installParts[0], installParts[1:]...).CombinedOutput(); err != nil {
				p.addLog("Installation failed: " + string(out))
				p.setError("installation failed: " + err.Error())
				return err
			}
			p.addLog("Installation successful")
		} else {
			p.addLog("Software check passed")
		}
	}

	// Interpolate variables
	finalCmd := p.interpolate(p.cmdStr)

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

	// Attempt to find public URL using custom regex
	if p.publicURL == "" && p.re != nil {
		if found := p.re.FindString(line); found != "" {
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
