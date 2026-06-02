// Global state and functions
window.sidebar = null;
window.backdrop = null;

window.toggleMobileMenu = () => {
    if (!window.sidebar || !window.backdrop) {
        window.sidebar = document.getElementById('sidebar');
        window.backdrop = document.getElementById('sidebar-backdrop');
    }
    if (!window.sidebar || !window.backdrop) return;
    window.sidebar.classList.toggle('-translate-x-full');
    window.sidebar.classList.toggle('open');
    window.backdrop.classList.toggle('hidden');
};

window.showSection = (sectionId) => {
    const sections = ['dashboard', 'tunnels', 'providers', 'deploy-tunnel', 'configure-engine'];
    const navLinks = document.querySelectorAll('.nav-link');
    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.remove('hidden');

    navLinks.forEach(link => {
        const activeSection = (sectionId === 'deploy-tunnel') ? 'tunnels' : (sectionId === 'configure-engine' ? 'providers' : sectionId);
        if (link.dataset.section === activeSection) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    const titles = {
        dashboard: 'Dashboard',
        tunnels: 'Tunnels',
        providers: 'Engines',
        'deploy-tunnel': 'Deploy Tunnel',
        'configure-engine': 'Configure Engine'
    };

    const breadcrumbs = {
        dashboard: 'Overview',
        tunnels: 'Edge Gateways',
        providers: 'Core Logic',
        'deploy-tunnel': 'Deployment',
        'configure-engine': 'Configuration'
    };

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[sectionId] || 'Dashboard';

    const breadcrumbEl = document.getElementById('breadcrumb-sub');
    if (breadcrumbEl) breadcrumbEl.innerText = breadcrumbs[sectionId] || 'Overview';

    if (!window.sidebar) window.sidebar = document.getElementById('sidebar');
    if (!window.backdrop) window.backdrop = document.getElementById('sidebar-backdrop');

    if (window.sidebar && window.sidebar.classList.contains('open')) {
        window.sidebar.classList.remove('open');
        window.sidebar.classList.add('-translate-x-full');
        if (window.backdrop) window.backdrop.classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.sidebar = document.getElementById('sidebar');
    window.backdrop = document.getElementById('sidebar-backdrop');
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.dataset.section) {
                e.preventDefault();
                showSection(link.dataset.section);
            }
        });
    });

    const mainEl = document.querySelector('main');
    if (mainEl) {
        mainEl.addEventListener('click', () => {
            if (window.innerWidth < 1024 && window.sidebar && window.sidebar.classList.contains('open')) {
                toggleMobileMenu();
            }
        });
    }

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
                        backgroundColor: ['#10b981', '#f43f5e', '#6366f1'],
                        hoverOffset: 4,
                        borderWidth: 0,
                        cutout: '75%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    animation: { animateRotate: true, animateScale: true }
                }
            });
        }
    };
    initCharts();

    // Provider Variables UI Logic
    const varsContainer = document.getElementById('variables-container');
    const addVarBtn = document.getElementById('add-variable-btn');

    const createVarRow = (v = {}) => {
        const rowId = 'var-' + Math.random().toString(36).substr(2, 9);
        const row = document.createElement('div');
        row.className = 'bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-300';
        row.id = rowId;
        row.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Label</label>
                    <input type="text" name="var_name" value="${v.name || ''}" placeholder="Protocol" class="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold focus:border-indigo-600 outline-none transition-all">
                </div>
                <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID (Internal)</label>
                    <input type="text" name="var_id" value="${v.id || ''}" placeholder="Protocol" class="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono focus:border-indigo-600 outline-none transition-all">
                </div>
                <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                    <select name="var_type" class="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold focus:border-indigo-600 outline-none transition-all appearance-none cursor-pointer">
                        <option value="input" ${v.type==='input'?'selected':''}>Text Input</option>
                        <option value="select" ${v.type==='select'?'selected':''}>Selection List</option>
                    </select>
                </div>
                <div class="flex items-end justify-between">
                    <div class="space-y-2 flex-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Default</label>
                        <input type="text" name="var_default" value="${v.default_value || ''}" placeholder="http" class="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold focus:border-indigo-600 outline-none transition-all">
                    </div>
                    <button type="button" onclick="document.getElementById('${rowId}').remove()" class="ml-4 mb-1 p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            <div class="options-container ${v.type === 'select' ? '' : 'hidden'} space-y-4">
                <div class="flex justify-between items-center bg-white px-4 py-2 rounded-xl border border-slate-100">
                    <label class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Available Options</label>
                    <button type="button" class="add-opt-btn text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Add Entry</button>
                </div>
                <div class="opts-list grid grid-cols-2 gap-3">
                    <!-- Options -->
                </div>
            </div>
        `;

        const typeSelect = row.querySelector('select[name="var_type"]');
        const optsContainer = row.querySelector('.options-container');
        const optsList = row.querySelector('.opts-list');
        const addOptBtn = row.querySelector('.add-opt-btn');

        const createOptRow = (opt = {}) => {
            const optRow = document.createElement('div');
            optRow.className = 'flex items-center space-x-2 animate-in slide-in-from-left-2 duration-200';
            optRow.innerHTML = `
                <input type="text" name="opt_name" value="${opt.name || ''}" placeholder="Label" class="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none focus:border-indigo-600 transition-all">
                <input type="text" name="opt_value" value="${opt.value || ''}" placeholder="Value" class="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-mono outline-none focus:border-indigo-600 transition-all">
                <button type="button" onclick="this.parentElement.remove()" class="text-slate-300 hover:text-rose-500 p-1">×</button>
            `;
            optsList.appendChild(optRow);
        };

        typeSelect.addEventListener('change', () => {
            optsContainer.classList.toggle('hidden', typeSelect.value !== 'select');
        });

        addOptBtn.addEventListener('click', () => createOptRow());
        if (v.options) v.options.forEach(opt => createOptRow(opt));
        if (varsContainer) varsContainer.appendChild(row);
    };

    if (addVarBtn) addVarBtn.addEventListener('click', () => createVarRow());

    // State & Rendering
    let globalTunnels = [];
    let globalProviders = [];

    const showToast = (msg, type = 'success') => {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-msg');
        const toastIcon = document.getElementById('toast-icon');
        if (!toast || !toastMsg || !toastIcon) return;

        toastMsg.innerText = msg;
        toastIcon.className = `w-2.5 h-2.5 rounded-full ${type === 'success' ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'}`;

        toast.classList.remove('hidden', 'translate-y-32');
        setTimeout(() => {
            toast.classList.add('translate-y-32');
            setTimeout(() => toast.classList.add('hidden'), 500);
        }, 4000);
    };

    const renderTunnels = () => {
        const tunnelGrid = document.getElementById('tunnel-grid');
        if (!tunnelGrid) return;

        tunnelGrid.innerHTML = globalTunnels.map(t => {
            const isError = t.status === 'ERROR';
            const isRunning = t.status === 'RUNNING';
            const isStarting = t.status === 'STARTING';
            const isStopped = t.status === 'STOPPED' || isError;

            const colorClass = isError ? 'rose' : (isRunning ? 'emerald' : 'indigo');
            const statusLabel = isStarting ? 'Orchestrating...' : t.status;

            return `
            <div class="premium-card p-8 flex flex-col space-y-8 border-t-4 border-${colorClass}-500 ${isStarting ? 'opacity-80' : ''}">
                <div class="flex justify-between items-start">
                    <div class="space-y-2">
                        <div class="flex items-center space-x-3">
                            <div class="w-2.5 h-2.5 rounded-full bg-${colorClass}-500 ${isStarting ? 'pulse-animation' : ''} shadow-[0_0_8px_rgba(0,0,0,0.1)]"></div>
                            <h3 class="font-black text-slate-900 tracking-tight">${t.name}</h3>
                        </div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">${t.type} &bull; ${statusLabel}</p>
                        ${t.error ? `<p class="text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg mt-2 ring-1 ring-rose-100">${t.error}</p>` : ''}
                    </div>
                    <div class="flex space-x-2">
                         <button onclick="showLogs('${t.id}', '${t.name}')" title="Inspect Streams" class="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </button>
                        <button onclick="deleteTunnel('${t.id}')" title="Terminate" class="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>

                <div class="bg-slate-50/80 rounded-2xl p-5 space-y-4 border border-slate-100">
                    <div class="flex flex-col space-y-1.5">
                        <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Public Endpoint</span>
                        <a href="${t.public_url}" target="_blank" class="text-xs font-black text-indigo-600 truncate hover:underline">${t.public_url || 'Allocating...'}</a>
                    </div>
                </div>

                <div class="flex space-x-3 mt-auto">
                    ${isStopped ?
                        `<button onclick="startTunnel('${t.id}')" class="flex-1 py-3.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-95">Awaken</button>` :
                        `<button onclick="stopTunnel('${t.id}')" class="flex-1 py-3.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-xl hover:bg-black shadow-lg shadow-slate-200 transition-all active:scale-95">Freeze</button>`
                    }
                    <button onclick="restartTunnel('${t.id}')" class="flex-1 py-3.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl hover:bg-slate-200 transition-all active:scale-95">Reboot</button>
                </div>
            </div>
            `;
        }).join('');
    };

    const fetchTunnels = async () => {
        try {
            const res = await fetch('/api/tunnels');
            if (!res.ok) throw new Error();
            globalTunnels = await res.json();
            renderTunnels();
        } catch (e) {}
    };

    const updateStats = async () => {
        try {
            const res = await fetch('/api/stats');
            if (!res.ok) throw new Error();
            const stats = await res.json();

            const sets = {
                'stat-total': stats.total,
                'stat-running': stats.running,
                'stat-starting': stats.starting,
                'stat-error': stats.error,
                'stat-providers': stats.providers,
                'stat-active-sessions': stats.running,
                'stat-starting-count': stats.starting
            };

            Object.entries(sets).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            });

            if (doughnutChart) {
                doughnutChart.data.datasets[0].data = [stats.running, stats.error, stats.starting];
                doughnutChart.update();
            }

            const sysMsg = document.getElementById('system-status-msg');
            const sysContainer = document.getElementById('system-status-container');
            const sysIcon = document.getElementById('system-status-icon');
            const connStatus = document.getElementById('connection-status');

            if (stats.error > 0) {
                if (sysMsg) sysMsg.innerText = 'Attention Required';
                if (sysContainer) sysContainer.className = 'w-20 h-20 bg-rose-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-rose-200 ring-4 ring-rose-50 transition-all duration-500';
                if (sysIcon) sysIcon.innerHTML = '<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
            } else {
                if (sysMsg) sysMsg.innerText = 'System Optimized';
                if (sysContainer) sysContainer.className = 'w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-200 ring-4 ring-emerald-50 transition-all duration-500';
                if (sysIcon) sysIcon.innerHTML = '<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
            }

            if (connStatus) {
                connStatus.className = 'flex items-center space-x-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100 transition-all duration-500';
                connStatus.innerHTML = '<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span><span>System Connected</span>';
            }

        } catch (e) {
            const connStatus = document.getElementById('connection-status');
            if (connStatus) {
                connStatus.className = 'flex items-center space-x-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-100 transition-all duration-500';
                connStatus.innerHTML = '<span class="w-1.5 h-1.5 bg-rose-500 rounded-full pulse-animation"></span><span>Signal Lost</span>';
            }
        }
    };

    // Optimistic Actions
    const performAction = async (id, action, successMsg) => {
        const tunnel = globalTunnels.find(t => t.id === id);
        if (!tunnel) return;

        const originalStatus = tunnel.status;

        // Optimistic State
        if (action === 'start' || action === 'restart') tunnel.status = 'STARTING';
        if (action === 'stop') tunnel.status = 'STOPPED';
        renderTunnels();

        try {
            const res = await fetch(`/api/tunnels/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error();
            showToast(successMsg);
        } catch (e) {
            tunnel.status = originalStatus;
            renderTunnels();
            showToast('Gateway Interrupted', 'error');
        }
        fetchTunnels();
    };

    window.startTunnel = (id) => performAction(id, 'start', 'Deployment Awakened');
    window.stopTunnel = (id) => performAction(id, 'stop', 'Gateway Frozen');
    window.restartTunnel = (id) => performAction(id, 'restart', 'Node Rebooted');

    window.deleteTunnel = async (id) => {
        if (!confirm('Permanently terminate this proxy gateway?')) return;
        const index = globalTunnels.findIndex(t => t.id === id);
        const original = globalTunnels[index];

        globalTunnels.splice(index, 1);
        renderTunnels();

        try {
            await fetch('/api/tunnels/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
            showToast('Deployment Terminated');
        } catch (e) {
            globalTunnels.splice(index, 0, original);
            renderTunnels();
            showToast('Termination Failed', 'error');
        }
        fetchTunnels();
        updateStats();
    };

    // Engines
    const fetchProviders = async () => {
        try {
            const res = await fetch('/api/providers');
            globalProviders = await res.json();

            const typeSelect = document.querySelector('select[name="type"]');
            if (typeSelect) {
                typeSelect.innerHTML = globalProviders.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
                renderTunnelForm(typeSelect.value);
            }

            const grid = document.getElementById('provider-grid');
            if (grid) {
                grid.innerHTML = globalProviders.map(p => `
                    <div class="premium-card p-8 flex flex-col space-y-6">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-black text-slate-900 tracking-tight">${p.name}</h3>
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-2">${p.type}</p>
                            </div>
                            ${p.type !== 'Built-in Engine' ? `
                            <button onclick="deleteProvider('${p.name}')" class="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>` : ''}
                        </div>
                        <div class="bg-slate-900 rounded-xl p-4 border border-white/5 ring-1 ring-slate-800">
                            <code class="text-[10px] text-emerald-400 font-mono break-all font-bold">${p.command}</code>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {}
    };

    window.deleteProvider = async (name) => {
        if (!confirm(`Wipe engine "${name}"?`)) return;
        try {
            await fetch(`/api/providers?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
            showToast('Engine Purged');
            fetchProviders();
        } catch (e) { showToast('Purge Failed', 'error'); }
    };

    const renderTunnelForm = (providerName) => {
        const container = document.getElementById('dynamic-tunnel-vars');
        if (!container) return;
        container.innerHTML = '';
        const provider = globalProviders.find(p => p.name === providerName);
        if (!provider || !provider.variables) return;

        provider.variables.forEach(v => {
            const div = document.createElement('div');
            div.className = 'space-y-3';
            const label = `<label class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">${v.name}</label>`;

            if (v.type === 'select') {
                div.innerHTML = `
                    ${label}
                    <div class="relative group">
                        <select name="config_${v.id}" class="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-xs font-bold focus:bg-white focus:border-indigo-600 outline-none appearance-none cursor-pointer transition-all">
                            ${v.options.map(opt => `<option value="${opt.value}" ${opt.value === v.default_value ? 'selected' : ''}>${opt.name}</option>`).join('')}
                        </select>
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-width="3"></path></svg>
                        </div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    ${label}
                    <input type="text" name="config_${v.id}" value="${v.default_value || ''}" placeholder="${v.name}" class="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-xs font-bold focus:bg-white focus:border-indigo-600 outline-none transition-all">
                `;
            }
            container.appendChild(div);
        });
    };

    document.querySelector('select[name="type"]')?.addEventListener('change', (e) => renderTunnelForm(e.target.value));

    window.closeModal = (id) => {
        document.getElementById(id).classList.add('hidden');
        if (id === 'provider-modal') {
            document.getElementById('provider-form').reset();
            document.getElementById('variables-container').innerHTML = '';
        }
    };

    // Submissions
    document.getElementById('tunnel-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.062 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Deploying...</span>';

        const fd = new FormData(e.target);
        const rawData = Object.fromEntries(fd.entries());
        const data = { name: rawData.name, type: rawData.type, config: {} };
        Object.keys(rawData).forEach(k => { if(k.startsWith('config_')) data.config[k.replace('config_', '')] = rawData[k]; });

        try {
            const res = await fetch('/api/tunnels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error(await res.text());
            showToast('Protocol Dispatched');
            showSection('tunnels');
            fetchTunnels();
            updateStats();
        } catch (e) {
            showToast(e.message || 'Dispatch Failed', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    document.getElementById('provider-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.062 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Integrating...</span>';

        const fd = new FormData(e.target);
        const data = {
            name: fd.get('name'), regex: fd.get('regex'), command: fd.get('command'),
            check_cmd: fd.get('check_cmd'), install_cmd: fd.get('install_cmd'), variables: []
        };

        document.querySelectorAll('#variables-container .bg-slate-50').forEach(row => {
            const v = {
                name: row.querySelector('[name="var_name"]').value,
                id: row.querySelector('[name="var_id"]').value,
                type: row.querySelector('[name="var_type"]').value,
                default_value: row.querySelector('[name="var_default"]').value,
                options: []
            };
            if (v.type === 'select') {
                row.querySelectorAll('.opts-list > div').forEach(optRow => {
                    v.options.push({ name: optRow.querySelector('[name="opt_name"]').value, value: optRow.querySelector('[name="opt_value"]').value });
                });
            }
            data.variables.push(v);
        });

        try {
            await fetch('/api/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showToast('Engine Integrated');
            showSection('providers');
            fetchProviders();
        } catch (e) {
            showToast('Integration Failed', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    // Logs
    let logInterval = null;
    window.showLogs = async (id, name) => {
        document.getElementById('log-node-name').innerText = name;
        const container = document.getElementById('log-container');
        container.innerHTML = '';
        document.getElementById('logs-modal').classList.remove('hidden');
        const poll = async () => {
            try {
                const res = await fetch(`/api/tunnels/logs?id=${id}`);
                const logs = await res.json();
                container.innerHTML = logs.map(l => `<div class="opacity-80 py-0.5 border-b border-white/5 last:border-0"><span class="text-indigo-400 font-black mr-2">&rsaquo;</span>${l}</div>`).join('') || '<p class="text-slate-500 italic">Awaiting packet stream...</p>';
                container.scrollTop = container.scrollHeight;
            } catch (e) {}
        };
        poll();
        logInterval = setInterval(poll, 2000);
    };

    const originalClose = window.closeModal;
    window.closeModal = (id) => {
        if (id === 'logs-modal') clearInterval(logInterval);
        originalClose(id);
    };

    // Init
    fetchProviders();
    fetchTunnels();
    updateStats();
    setInterval(() => { fetchTunnels(); updateStats(); }, 2500);
});
