document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = ['dashboard', 'tunnels', 'providers', 'settings'];
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('menu-backdrop');

    const toggleMenu = (show) => {
        if (show) {
            mobileMenu.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            mobileMenu.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    };

    const showSection = (sectionId) => {
        sections.forEach(s => {
            const el = document.getElementById(`section-${s}`);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(`section-${sectionId}`);
        if (target) target.classList.remove('hidden');

        navLinks.forEach(link => {
            if (link.dataset.section === sectionId) {
                link.classList.add('active-link');
                link.classList.remove('text-[#8b949e]');
                link.classList.add('text-white');
            } else {
                link.classList.remove('active-link');
                link.classList.add('text-[#8b949e]');
                link.classList.remove('text-white');
            }
        });

        toggleMenu(false);
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(link.dataset.section);
        });
    });

    menuToggle.addEventListener('click', () => toggleMenu(true));
    backdrop.addEventListener('click', () => toggleMenu(false));

    // Charting Logic
    const pieCanvas = document.getElementById('pieChart');
    let pieChart = null;
    if (pieCanvas) {
        const ctx = pieCanvas.getContext('2d');
        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Healthy', 'Starting', 'Critical', 'Idle'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#3fb950', '#d29922', '#f85149', '#484f58'],
                    borderWidth: 0,
                    hoverOffset: 15,
                    cutout: '75%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#8b949e',
                            font: { family: 'Inter', weight: '600', size: 10 },
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    // API Handling
    const tunnelGrid = document.getElementById('tunnel-grid');
    const providerGrid = document.getElementById('provider-grid');
    const tunnelForm = document.getElementById('tunnel-form');
    const providerForm = document.getElementById('provider-form');
    const typeSelect = tunnelForm.querySelector('select[name="type"]');
    const ngrokTokenField = document.getElementById('ngrok-token-field');
    const modalTitle = document.getElementById('modal-title');

    let globalProviders = [];

    const renderDynamicFields = (providerName) => {
        document.querySelectorAll('.dynamic-field').forEach(el => el.remove());

        const builtIn = [
            { name: 'cloudflare', variables: [] }, // Handled by static fields
            { name: 'ngrok', variables: [] }       // Handled by static fields
        ];

        const provider = [...builtIn, ...globalProviders].find(p => p.name === providerName);
        if (!provider || !provider.variables || provider.variables.length === 0) return;

        const container = tunnelForm.querySelector('.grid');
        provider.variables.forEach(v => {
            const div = document.createElement('div');
            div.className = 'dynamic-field space-y-6';
            div.innerHTML = `
                <label class="block text-[10px] font-black text-[#8b949e] uppercase tracking-[0.3em]">${v}</label>
                <input type="text" name="config_${v}" placeholder="Enter ${v}" class="w-full bg-[#0b0d11] border border-[#21262d] rounded-2xl p-5 text-white focus:ring-2 ring-[#a371f7]/30 border-[#a371f7]/50 outline-none transition-all placeholder:text-[#30363d]" required>
            `;
            container.appendChild(div);
        });
    };

    typeSelect.addEventListener('change', () => {
        const val = typeSelect.value;
        ngrokTokenField.classList.toggle('hidden', val !== 'ngrok');
        renderDynamicFields(val);
    });

    window.closeModal = (id) => {
        document.getElementById(id).classList.add('hidden');
        if (id === 'add-modal') {
            tunnelForm.reset();
            tunnelForm.id.value = '';
            modalTitle.innerText = 'Create Node';
            document.querySelectorAll('.dynamic-field').forEach(el => el.remove());
        }
    };

    const updateStats = async () => {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();

            const setStat = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            };

            setStat('stat-total', stats.total);
            setStat('stat-running', stats.running);
            setStat('stat-starting', stats.starting);
            setStat('stat-error', stats.error);
            setStat('stat-providers', stats.providers);

            if (pieChart) {
                pieChart.data.datasets[0].data = [stats.running, stats.starting, stats.error, stats.stopped];
                pieChart.update();
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchProviders = async () => {
        try {
            const response = await fetch('/api/providers');
            globalProviders = await response.json();

            const currentVal = typeSelect.value;
            typeSelect.innerHTML = `
                <option value="cloudflare">Cloudflare Quick Tunnel</option>
                <option value="ngrok">Ngrok SDK (Official)</option>
                ${globalProviders.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            `;
            if (globalProviders.some(p => p.name === currentVal) || ['cloudflare', 'ngrok'].includes(currentVal)) {
                typeSelect.value = currentVal;
            }

            if (providerGrid) {
                const builtIn = [
                    { name: 'Cloudflare', type: 'Built-in Engine', command: 'cloudflared tunnel --url ${Port}', variables: ['Port'], builtIn: true },
                    { name: 'Ngrok', type: 'Built-in Engine', command: 'ngrok-sdk-native', variables: ['Port', 'Token'], builtIn: true }
                ];
                const allProviders = [...builtIn, ...globalProviders.map(p => ({...p, type: 'Custom Engine'}))];

                providerGrid.innerHTML = allProviders.map(p => `
                    <div class="card p-8 flex flex-col space-y-6">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-xl font-black text-white">${p.name}</h3>
                                <p class="text-[10px] text-[#8b949e] font-bold uppercase tracking-widest mt-1">${p.type}</p>
                            </div>
                            ${p.builtIn ? '' : `
                            <button onclick="deleteProvider('${p.name}')" class="text-red-500 hover:text-red-400">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                            `}
                        </div>
                        <div class="bg-[#0b0d11] p-4 rounded-xl border border-[#21262d]">
                            <code class="text-[11px] text-[#a371f7] break-all">${p.command}</code>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            ${(p.variables || []).map(v => `<span class="px-2 py-1 bg-[#1c2128] rounded text-[9px] font-black text-white uppercase border border-[#21262d]">${v}</span>`).join('')}
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Failed to fetch providers:', err);
        }
    };

    window.deleteProvider = async (name) => {
        if (!confirm('Delete this provider engine?')) return;
        const res = await fetch(`/api/providers?name=${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        if (res.ok) fetchProviders();
    };

    providerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(providerForm).entries());
        const res = await fetch('/api/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            closeModal('provider-modal');
            fetchProviders();
            updateStats();
        }
    });

    const fetchTunnels = async () => {
        try {
            const response = await fetch('/api/tunnels');
            const tunnels = await response.json();

            if (!tunnelGrid) return;

            tunnelGrid.innerHTML = tunnels.map(t => {
                const statusColor = t.status === 'RUNNING' ? '#3fb950' : (t.status === 'STARTING' ? '#d29922' : (t.status === 'ERROR' ? '#f85149' : '#484f58'));
                const isStopped = t.status === 'STOPPED' || t.status === 'ERROR';

                return `
                <div class="card p-8 flex flex-col space-y-8 relative group overflow-visible border-l-4" style="border-left-color: ${statusColor}">
                    <div class="flex justify-between items-start">
                        <div class="space-y-2">
                            <div class="flex items-center space-x-3">
                                <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_${statusColor}] ${t.status === 'STARTING' ? 'animate-pulse' : ''}" style="background-color: ${statusColor}"></div>
                                <h3 class="text-xl font-black text-white tracking-tight">${t.name}</h3>
                            </div>
                            <div class="flex items-center space-x-4">
                                <span class="px-2.5 py-1 rounded-md bg-[#21262d] text-[#a371f7] text-[10px] font-black uppercase tracking-widest border border-[#30363d]">
                                    ${t.type}
                                </span>
                                <span class="text-[10px] font-bold text-[#8b949e] uppercase tracking-widest">${t.status}</span>
                            </div>
                        </div>

                        <div class="relative dropdown-container">
                            <button onclick="toggleDropdown(event, '${t.id}')" class="p-2.5 text-[#8b949e] hover:text-white rounded-xl hover:bg-[#21262d] transition-all bg-[#0b0d11]">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                            </button>
                            <div id="dropdown-${t.id}" class="hidden absolute right-0 mt-3 w-56 dropdown-menu rounded-2xl py-3 overflow-hidden z-[50]">
                                <a href="#" onclick="editTunnel(event, ${JSON.stringify(t).replace(/"/g, '&quot;')})" class="flex items-center px-5 py-3 text-xs font-bold text-white dropdown-item">
                                    <svg class="w-4 h-4 mr-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    Edit Config
                                </a>
                                ${isStopped ?
                                    `<a href="#" onclick="startTunnel('${t.id}')" class="flex items-center px-5 py-3 text-xs font-bold text-[#3fb950] dropdown-item">
                                        <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Start Node
                                    </a>` :
                                    `<a href="#" onclick="stopTunnel('${t.id}')" class="flex items-center px-5 py-3 text-xs font-bold text-yellow-500 dropdown-item">
                                        <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Stop Node
                                    </a>`
                                }
                                <a href="#" onclick="restartTunnel('${t.id}')" class="flex items-center px-5 py-3 text-xs font-bold text-white dropdown-item">
                                    <svg class="w-4 h-4 mr-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                    Restart
                                </a>
                                <div class="border-t border-[#30363d] my-2"></div>
                                <a href="#" onclick="showLogs('${t.id}', '${t.name}')" class="flex items-center px-5 py-3 text-xs font-bold text-white dropdown-item">
                                    <svg class="w-4 h-4 mr-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    View Terminal
                                </a>
                                <a href="#" onclick="deleteTunnel('${t.id}')" class="flex items-center px-5 py-3 text-xs font-bold text-red-500 dropdown-item">
                                    <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Terminate
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="bg-[#0b0d11] rounded-2xl p-5 border border-[#21262d] flex flex-col space-y-4">
                        <div class="flex items-center justify-between text-[11px] font-bold">
                            <span class="text-[#8b949e] uppercase tracking-widest">Internal Host</span>
                            <span class="text-white font-mono">${t.local_addr}</span>
                        </div>
                        <div class="h-px bg-[#21262d]"></div>
                        <div class="flex items-center justify-between">
                            <div class="flex flex-col">
                                <span class="text-[9px] text-[#8b949e] font-black uppercase tracking-widest mb-1">Public Endpoint</span>
                                <a href="${t.public_url}" target="_blank" class="text-xs font-bold text-[#58a6ff] hover:underline truncate max-w-[200px]">
                                    ${t.public_url || (t.status === 'ERROR' ? 'Failed' : 'Allocating...')}
                                </a>
                            </div>
                            <a href="${t.public_url}" target="_blank" class="px-5 py-2.5 bg-[#a371f7] rounded-xl text-[10px] font-black text-white uppercase tracking-tighter hover:scale-105 transition-all shadow-lg shadow-[#a371f7]/20">
                                Visit
                            </a>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Failed to fetch tunnels:', err);
        }
    };

    window.toggleDropdown = (e, id) => {
        e.stopPropagation();
        const el = document.getElementById(`dropdown-${id}`);
        const all = document.querySelectorAll('.dropdown-menu');
        all.forEach(d => { if(d.id !== `dropdown-${id}`) d.classList.add('hidden') });
        el.classList.toggle('hidden');
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
    });

    tunnelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(tunnelForm);
        const rawData = Object.fromEntries(formData.entries());

        const data = {
            id: rawData.id,
            name: rawData.name,
            type: rawData.type,
            local_addr: rawData.local_addr,
            token: rawData.token,
            config: {}
        };

        Object.keys(rawData).forEach(key => {
            if (key.startsWith('config_')) {
                data.config[key.replace('config_', '')] = rawData[key];
            }
        });

        if (!data.local_addr.includes(':') && data.local_addr !== "") {
            data.local_addr = `localhost:${data.local_addr}`;
        }

        const response = await fetch('/api/tunnels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal('add-modal');
            fetchTunnels();
            updateStats();
        } else {
            const err = await response.text();
            alert('Deployment failed: ' + err);
        }
    });

    window.startTunnel = async (id) => {
        const response = await fetch('/api/tunnels/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (response.ok) { fetchTunnels(); updateStats(); }
    };

    window.stopTunnel = async (id) => {
        const response = await fetch('/api/tunnels/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (response.ok) { fetchTunnels(); updateStats(); }
    };

    window.restartTunnel = async (id) => {
        const response = await fetch('/api/tunnels/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (response.ok) { fetchTunnels(); updateStats(); }
    };

    window.deleteTunnel = async (id) => {
        if (!confirm('Are you sure you want to terminate this node? This cannot be undone.')) return;
        const response = await fetch('/api/tunnels/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (response.ok) { fetchTunnels(); updateStats(); }
    };

    window.editTunnel = (e, tunnel) => {
        e.preventDefault();
        modalTitle.innerText = 'Edit Node';
        tunnelForm.id.value = tunnel.id;
        tunnelForm.name.value = tunnel.name;
        tunnelForm.type.value = tunnel.type;
        tunnelForm.local_addr.value = tunnel.local_addr;
        ngrokTokenField.classList.toggle('hidden', tunnel.type !== 'ngrok');

        renderDynamicFields(tunnel.type);
        // Fill dynamic fields
        if (tunnel.config) {
            Object.keys(tunnel.config).forEach(k => {
                const input = tunnelForm.querySelector(`input[name="config_${k}"]`);
                if (input) input.value = tunnel.config[k];
            });
        }

        document.getElementById('add-modal').classList.remove('hidden');
    };

    let logInterval = null;
    window.showLogs = async (id, name) => {
        document.getElementById('log-node-name').innerText = name;
        const container = document.getElementById('log-container');
        container.innerHTML = '<div class="opacity-50"># Attaching to stream...</div>';
        document.getElementById('logs-modal').classList.remove('hidden');

        const fetchLogs = async () => {
            try {
                const res = await fetch(`/api/tunnels/logs?id=${id}`);
                const logs = await res.json();
                container.innerHTML = logs.map(l => `<div class="py-0.5"><span class="text-[#8b949e] mr-2">>>></span>${l}</div>`).join('') || '<div class="opacity-50"># No log output yet.</div>';
                container.scrollTop = container.scrollHeight;
            } catch(e) {}
        };

        fetchLogs();
        logInterval = setInterval(fetchLogs, 2000);
    };

    const originalCloseModal = window.closeModal;
    window.closeModal = (id) => {
        if (id === 'logs-modal') {
            clearInterval(logInterval);
            logInterval = null;
        }
        originalCloseModal(id);
    };

    // Initial load and polling
    fetchProviders();
    fetchTunnels();
    updateStats();
    setInterval(() => {
        fetchProviders();
        fetchTunnels();
        updateStats();
    }, 5000);
});
