document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = ['dashboard', 'tunnels', 'providers'];
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobile-toggle');

    const backdrop = document.getElementById('sidebar-backdrop');
    const toggleMobileMenu = () => {
        sidebar.classList.toggle('-translate-x-full');
        backdrop.classList.toggle('hidden');
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
                link.classList.add('active');
                link.classList.remove('text-gray-500');
            } else {
                link.classList.remove('active');
                link.classList.add('text-gray-500');
            }
        });

        // Update Title
        const titles = { dashboard: 'Dashboard', tunnels: 'Tunnels', providers: 'Providers' };
        document.getElementById('page-title').innerText = titles[sectionId] || 'Dashboard';

        // Close sidebar and backdrop on navigation
        if (!sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.dataset.section) {
                e.preventDefault();
                showSection(link.dataset.section);
            }
        });
    });

    mobileToggle.addEventListener('click', toggleMobileMenu);
    backdrop.addEventListener('click', toggleMobileMenu);

    // Close sidebar if user clicks on the main content while it's open (mobile)
    document.querySelector('main').addEventListener('click', () => {
        if (window.innerWidth < 1024 && !sidebar.classList.contains('-translate-x-full')) {
            toggleMobileMenu();
        }
    });

    // Charting Logic
    let doughnutChart = null;

    const initCharts = () => {
        const doughnutCtx = document.getElementById('doughnutChart')?.getContext('2d');
        if (doughnutCtx) {
            doughnutChart = new Chart(doughnutCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Healthy', 'Error', 'Starting'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#3fb950', '#ff5b5b', '#faad14'],
                        borderWidth: 0,
                        cutout: '70%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }
    };

    initCharts();

    // API Handling
    const tunnelGrid = document.getElementById('tunnel-grid');
    const providerGrid = document.getElementById('provider-grid');
    const tunnelForm = document.getElementById('tunnel-form');
    const providerForm = document.getElementById('provider-form');
    const typeSelect = tunnelForm.querySelector('select[name="type"]');
    const tokenField = document.getElementById('token-field');
    const portField = document.getElementById('port-field');
    const modalTitle = document.getElementById('modal-title');

    let globalProviders = [];

    const renderDynamicFields = (providerName) => {
        document.querySelectorAll('.dynamic-field').forEach(el => el.remove());
        const provider = globalProviders.find(p => p.name === providerName);
        if (!provider || !provider.variables) return;

        const container = tunnelForm.querySelector('.grid');
        provider.variables.forEach(v => {
            const div = document.createElement('div');
            div.className = 'dynamic-field space-y-2';
            div.innerHTML = `
                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${v}</label>
                <input type="text" name="config_${v}" placeholder="Enter ${v}" class="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:border-red-500 outline-none">
            `;
            container.appendChild(div);
        });
    };

    typeSelect.addEventListener('change', () => {
        const val = typeSelect.value;
        const isManaged = val === 'Cloudflare (Managed)';
        const isNgrok = val === 'ngrok';
        tokenField.classList.toggle('hidden', !isManaged && !isNgrok);
        portField.classList.toggle('hidden', isManaged);
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

            document.getElementById('stat-total').innerText = stats.total;
            document.getElementById('stat-running').innerText = stats.running;
            document.getElementById('stat-starting').innerText = stats.starting;
            document.getElementById('stat-error').innerText = stats.error;
            document.getElementById('stat-providers').innerText = stats.providers;

            document.getElementById('stat-active-sessions').innerText = stats.running;
            document.getElementById('stat-starting-count').innerText = stats.starting;

            if (doughnutChart) {
                doughnutChart.data.datasets[0].data = [stats.running, stats.error, stats.starting];
                doughnutChart.update();
            }
        } catch (err) { console.error(err); }
    };

    const fetchProviders = async () => {
        try {
            const response = await fetch('/api/providers');
            globalProviders = await response.json();

            const currentVal = typeSelect.value;
            const builtInNames = ['Cloudflare (Quick)', 'Cloudflare (Managed)', 'Ngrok'];
            const others = globalProviders.filter(p => !builtInNames.includes(p.name));

            typeSelect.innerHTML = `
                <option value="Cloudflare (Quick)">Cloudflare Quick</option>
                <option value="Cloudflare (Managed)">Cloudflare Managed</option>
                <option value="ngrok">Ngrok SDK</option>
                ${others.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            `;
            typeSelect.value = currentVal || 'Cloudflare (Quick)';

            if (providerGrid) {
                providerGrid.innerHTML = globalProviders.map(p => `
                    <div class="card p-6 flex flex-col space-y-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-extrabold text-gray-900">${p.name}</h3>
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Engine</p>
                            </div>
                            <button onclick="deleteProvider('${p.name}')" class="text-gray-300 hover:text-red-500">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <code class="text-[10px] text-red-500 font-mono break-all">${p.command}</code>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {}
    };

    window.deleteProvider = async (name) => {
        if (!confirm('Delete engine?')) return;
        await fetch(`/api/providers?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
        fetchProviders();
    };

    providerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(providerForm).entries());
        await fetch('/api/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        closeModal('provider-modal');
        fetchProviders();
    });

    const fetchTunnels = async () => {
        try {
            const response = await fetch('/api/tunnels');
            const tunnels = await response.json();
            if (!tunnelGrid) return;

            tunnelGrid.innerHTML = tunnels.map(t => {
                const color = t.status === 'RUNNING' ? 'green' : (t.status === 'ERROR' ? 'red' : 'yellow');
                const isStopped = t.status === 'STOPPED' || t.status === 'ERROR';

                return `
                <div class="card p-6 flex flex-col space-y-6 border-t-4 border-${color}-500">
                    <div class="flex justify-between items-start">
                        <div class="space-y-1">
                            <div class="flex items-center space-x-2">
                                <div class="w-2 h-2 rounded-full bg-${color}-500 ${t.status === 'STARTING' ? 'animate-pulse' : ''}"></div>
                                <h3 class="font-extrabold text-gray-900">${t.name}</h3>
                            </div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${t.type} • ${t.status}</p>
                        </div>
                        <div class="flex space-x-1">
                             <button onclick="showLogs('${t.id}', '${t.name}')" class="p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </button>
                            <button onclick="deleteTunnel('${t.id}')" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>

                    <div class="bg-gray-50 rounded-xl p-4 space-y-3">
                        <div class="flex justify-between text-[10px] font-bold">
                            <span class="text-gray-400">HOST</span>
                            <span class="text-gray-900">${t.local_addr}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-bold text-gray-400">PUBLIC URL</span>
                            <a href="${t.public_url}" target="_blank" class="text-[11px] font-bold text-blue-500 truncate max-w-[120px]">${t.public_url || 'Allocating...'}</a>
                        </div>
                    </div>

                    <div class="flex space-x-2">
                        ${isStopped ?
                            `<button onclick="startTunnel('${t.id}')" class="flex-1 py-2 bg-green-50 text-green-600 text-[10px] font-extrabold uppercase rounded-lg hover:bg-green-100">Start</button>` :
                            `<button onclick="stopTunnel('${t.id}')" class="flex-1 py-2 bg-yellow-50 text-yellow-600 text-[10px] font-extrabold uppercase rounded-lg hover:bg-yellow-100">Stop</button>`
                        }
                        <button onclick="restartTunnel('${t.id}')" class="flex-1 py-2 bg-gray-50 text-gray-600 text-[10px] font-extrabold uppercase rounded-lg hover:bg-gray-100">Restart</button>
                    </div>
                </div>
                `;
            }).join('');
        } catch (err) {}
    };

    tunnelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawData = Object.fromEntries(new FormData(tunnelForm).entries());
        const data = {
            id: rawData.id, name: rawData.name, type: rawData.type, local_addr: rawData.local_addr, token: rawData.token,
            config: { Protocol: rawData.protocol || 'http', Port: rawData.local_addr, Token: rawData.token }
        };
        Object.keys(rawData).forEach(k => { if(k.startsWith('config_')) data.config[k.replace('config_', '')] = rawData[k]; });

        const res = await fetch('/api/tunnels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) { closeModal('add-modal'); fetchTunnels(); updateStats(); }
    });

    window.startTunnel = async (id) => { await fetch('/api/tunnels/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchTunnels(); updateStats(); };
    window.stopTunnel = async (id) => { await fetch('/api/tunnels/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchTunnels(); updateStats(); };
    window.restartTunnel = async (id) => { await fetch('/api/tunnels/restart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchTunnels(); updateStats(); };
    window.deleteTunnel = async (id) => { if (confirm('Terminate?')) { await fetch('/api/tunnels/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); fetchTunnels(); updateStats(); } };

    let logInterval = null;
    window.showLogs = async (id, name) => {
        document.getElementById('log-node-name').innerText = name;
        const container = document.getElementById('log-container');
        container.innerHTML = '';
        document.getElementById('logs-modal').classList.remove('hidden');
        const fetchLogs = async () => {
            const res = await fetch(`/api/tunnels/logs?id=${id}`);
            const logs = await res.json();
            container.innerHTML = logs.map(l => `<div class="opacity-80">${l}</div>`).join('') || 'Waiting for output...';
            container.scrollTop = container.scrollHeight;
        };
        fetchLogs();
        logInterval = setInterval(fetchLogs, 2000);
    };

    const originalCloseModal = window.closeModal;
    window.closeModal = (id) => {
        if (id === 'logs-modal') { clearInterval(logInterval); logInterval = null; }
        originalCloseModal(id);
    };

    fetchProviders();
    fetchTunnels();
    updateStats();
    setInterval(() => { fetchTunnels(); updateStats(); }, 5000);
});
