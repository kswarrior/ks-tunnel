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

        const titles = { dashboard: 'Dashboard', tunnels: 'Tunnels', providers: 'Providers' };
        document.getElementById('page-title').innerText = titles[sectionId] || 'Dashboard';

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

    // Provider Variables UI Logic
    const varsContainer = document.getElementById('variables-container');
    const addVarBtn = document.getElementById('add-variable-btn');

    const createVarRow = (v = {}) => {
        const rowId = 'var-' + Math.random().toString(36).substr(2, 9);
        const row = document.createElement('div');
        row.className = 'bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4';
        row.id = rowId;
        row.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="space-y-1">
                    <label class="text-[9px] font-bold text-gray-400 uppercase">Label</label>
                    <input type="text" name="var_name" value="${v.name || ''}" placeholder="Protocol" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-xs focus:border-red-500 outline-none">
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-bold text-gray-400 uppercase">ID (Internal)</label>
                    <input type="text" name="var_id" value="${v.id || ''}" placeholder="Protocol" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-xs focus:border-red-500 outline-none">
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-bold text-gray-400 uppercase">Type</label>
                    <select name="var_type" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-xs focus:border-red-500 outline-none">
                        <option value="input" ${v.type==='input'?'selected':''}>Input</option>
                        <option value="select" ${v.type==='select'?'selected':''}>Select</option>
                    </select>
                </div>
                <div class="flex items-end justify-between">
                    <div class="space-y-1 flex-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase">Default</label>
                        <input type="text" name="var_default" value="${v.default_value || ''}" placeholder="http" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-xs focus:border-red-500 outline-none">
                    </div>
                    <button type="button" onclick="document.getElementById('${rowId}').remove()" class="ml-2 mb-1 p-2 text-gray-300 hover:text-red-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
            <div class="options-container ${v.type === 'select' ? '' : 'hidden'} space-y-2">
                <div class="flex justify-between items-center">
                    <label class="text-[9px] font-bold text-gray-400 uppercase">Options</label>
                    <button type="button" class="add-opt-btn text-[8px] bg-white border px-2 py-0.5 rounded font-bold uppercase">Add Option</button>
                </div>
                <div class="opts-list grid grid-cols-2 gap-2">
                    <!-- Options filled here -->
                </div>
            </div>
        `;

        const typeSelect = row.querySelector('select[name="var_type"]');
        const optsContainer = row.querySelector('.options-container');
        const optsList = row.querySelector('.opts-list');
        const addOptBtn = row.querySelector('.add-opt-btn');

        const createOptRow = (opt = {}) => {
            const optRow = document.createElement('div');
            optRow.className = 'flex space-x-1';
            optRow.innerHTML = `
                <input type="text" name="opt_name" value="${opt.name || ''}" placeholder="Label" class="flex-1 bg-white border border-gray-100 rounded p-1 text-[10px] outline-none">
                <input type="text" name="opt_value" value="${opt.value || ''}" placeholder="Value" class="flex-1 bg-white border border-gray-100 rounded p-1 text-[10px] outline-none">
                <button type="button" onclick="this.parentElement.remove()" class="text-gray-300 hover:text-red-500 px-1">×</button>
            `;
            optsList.appendChild(optRow);
        };

        typeSelect.addEventListener('change', () => {
            optsContainer.classList.toggle('hidden', typeSelect.value !== 'select');
        });

        addOptBtn.addEventListener('click', () => createOptRow());

        if (v.options) v.options.forEach(opt => createOptRow(opt));

        varsContainer.appendChild(row);
    };

    addVarBtn.addEventListener('click', () => createVarRow());

    // API Handling
    const tunnelGrid = document.getElementById('tunnel-grid');
    const providerGrid = document.getElementById('provider-grid');
    const tunnelForm = document.getElementById('tunnel-form');
    const providerForm = document.getElementById('provider-form');
    const typeSelect = tunnelForm.querySelector('select[name="type"]');
    const dynamicTunnelVars = document.getElementById('dynamic-tunnel-vars');
    const modalTitle = document.getElementById('modal-title');

    let globalProviders = [];

    const renderTunnelForm = (providerName) => {
        dynamicTunnelVars.innerHTML = '';
        const provider = globalProviders.find(p => p.name === providerName);
        if (!provider || !provider.variables) return;

        provider.variables.forEach(v => {
            const div = document.createElement('div');
            div.className = 'space-y-2';
            const label = `<label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${v.name}</label>`;

            if (v.type === 'select') {
                div.innerHTML = `
                    ${label}
                    <select name="config_${v.id}" class="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:border-red-500 outline-none appearance-none cursor-pointer">
                        ${v.options.map(opt => `<option value="${opt.value}" ${opt.value === v.default_value ? 'selected' : ''}>${opt.name}</option>`).join('')}
                    </select>
                `;
            } else {
                div.innerHTML = `
                    ${label}
                    <input type="text" name="config_${v.id}" value="${v.default_value || ''}" placeholder="${v.name}" class="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm focus:border-red-500 outline-none">
                `;
            }
            dynamicTunnelVars.appendChild(div);
        });
    };

    typeSelect.addEventListener('change', () => renderTunnelForm(typeSelect.value));

    window.closeModal = (id) => {
        document.getElementById(id).classList.add('hidden');
        if (id === 'provider-modal') {
            providerForm.reset();
            varsContainer.innerHTML = '';
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

            const systemStatus = document.getElementById('system-status-msg');
            const systemIcon = document.getElementById('system-status-icon');
            if (systemStatus && systemIcon) {
                if (stats.error > 0) {
                    systemStatus.innerText = 'Action Required';
                    systemIcon.innerHTML = '<svg class="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
                    systemIcon.parentElement.classList.replace('bg-green-50', 'bg-yellow-50');
                } else {
                    systemStatus.innerText = 'System Healthy';
                    systemIcon.innerHTML = '<svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                    systemIcon.parentElement.classList.replace('bg-yellow-50', 'bg-green-50');
                }
            }
        } catch (err) {}
    };

    const fetchProviders = async () => {
        try {
            const response = await fetch('/api/providers');
            globalProviders = await response.json();

            typeSelect.innerHTML = globalProviders.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
            renderTunnelForm(typeSelect.value);

            if (providerGrid) {
                providerGrid.innerHTML = globalProviders.map(p => `
                    <div class="card p-6 flex flex-col space-y-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-extrabold text-gray-900">${p.name}</h3>
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">${p.type}</p>
                            </div>
                            ${p.type !== 'Built-in Engine' ? `
                            <button onclick="deleteProvider('${p.name}')" class="text-gray-300 hover:text-red-500">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>` : ''}
                        </div>
                        <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <code class="text-[10px] text-red-500 font-mono break-all">${p.command}</code>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {}
    };

    providerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(providerForm);
        const data = {
            name: fd.get('name'),
            regex: fd.get('regex'),
            command: fd.get('command'),
            check_cmd: fd.get('check_cmd'),
            install_cmd: fd.get('install_cmd'),
            variables: []
        };

        const rows = varsContainer.querySelectorAll('.bg-gray-50');
        rows.forEach(row => {
            const v = {
                name: row.querySelector('[name="var_name"]').value,
                id: row.querySelector('[name="var_id"]').value,
                type: row.querySelector('[name="var_type"]').value,
                default_value: row.querySelector('[name="var_default"]').value,
                options: []
            };
            if (v.type === 'select') {
                const optRows = row.querySelectorAll('.opts-list > div');
                optRows.forEach(optRow => {
                    v.options.push({
                        name: optRow.querySelector('[name="opt_name"]').value,
                        value: optRow.querySelector('[name="opt_value"]').value
                    });
                });
            }
            data.variables.push(v);
        });

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
                            ${t.error ? `<p class="text-[9px] text-red-500 font-medium bg-red-50 p-1 rounded mt-1">${t.error}</p>` : ''}
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
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-bold text-gray-400 uppercase">Public URL</span>
                            <a href="${t.public_url}" target="_blank" class="text-[11px] font-bold text-blue-500 truncate max-w-[150px]">${t.public_url || 'Allocating...'}</a>
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
            id: rawData.id, name: rawData.name, type: rawData.type,
            config: {}
        };
        Object.keys(rawData).forEach(k => { if(k.startsWith('config_')) data.config[k.replace('config_', '')] = rawData[k]; });
        try {
            const res = await fetch('/api/tunnels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                closeModal('add-modal');
                fetchTunnels();
                updateStats();
            } else {
                const err = await res.text();
                alert('Error: ' + err);
            }
        } catch (e) {
            alert('Failed to connect to server');
        }
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
    setInterval(() => { fetchTunnels(); updateStats(); }, 2000);
});
