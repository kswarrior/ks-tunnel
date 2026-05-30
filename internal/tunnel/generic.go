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
		placeholder := "${" + k + "}"
		if v == "" {
			// If value is empty, try to remove the preceding flag
			// Handle cases where placeholder is standalone: --flag ${Var}
			// or part of a URL: --url http://localhost:${Port}
			safePlaceholder := regexp.QuoteMeta(placeholder)
			// Match a flag followed by space and then either the placeholder OR something containing the placeholder (like a URL)
			re := regexp.MustCompile(`\s--?[a-zA-Z0-9-]+\s[^\s]*` + safePlaceholder + `[^\s]*`)
			if re.MatchString(cmd) {
				cmd = re.ReplaceAllString(cmd, "")
			} else {
				// Final fallback if no flag found
				cmd = strings.ReplaceAll(cmd, placeholder, "")
			}
		} else {
			cmd = strings.ReplaceAll(cmd, placeholder, v)
		}
	}
	// Clean up double spaces
	cmd = strings.Join(strings.Fields(cmd), " ")
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
	p.logs = make([]string, 0, 100) // Reset logs on start
	p.mu.Unlock()

	// Install on demand if commands are provided
	if p.checkCmd != "" && p.installCmd != "" {
		checkCmd := p.interpolate(p.checkCmd)
		p.addLog("Checking if software is installed: " + checkCmd)
		if err := exec.Command("sh", "-c", checkCmd).Run(); err != nil {
			p.addLog("Software not found. Installing...")
			installCmd := p.interpolate(p.installCmd)
			if out, err := exec.Command("sh", "-c", installCmd).CombinedOutput(); err != nil {
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

	if finalCmd == "" {
		p.setError("empty command")
		return fmt.Errorf("empty command")
	}

	cmd := exec.CommandContext(ctx, "sh", "-c", finalCmd)
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

	if stdout != nil {
		go p.scanLogs(stdout)
	}
	if stderr != nil {
		go p.scanLogs(stderr)
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				p.addLog("Recovered from background process panic")
			}
		}()
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

	// Capture common "Ready" or "Online" messages to confirm running status
	lower := strings.ToLower(line)
	if strings.Contains(lower, "online") || strings.Contains(lower, "ready") || strings.Contains(lower, "tunnel established") {
		if p.status == StatusStarting {
			p.status = StatusRunning
		}
	}
}

func (p *GenericProvider) scanLogs(r io.ReadCloser) {
	defer func() {
		if rec := recover(); rec != nil {
			p.addLog("Recovered from log scanning panic")
		}
	}()
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
