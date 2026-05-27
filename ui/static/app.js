document.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = ['dashboard', 'tunnels', 'settings'];
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
    const tunnelForm = document.getElementById('tunnel-form');
    const typeSelect = tunnelForm.querySelector('select[name="type"]');
    const ngrokTokenField = document.getElementById('ngrok-token-field');

    typeSelect.addEventListener('change', () => {
        ngrokTokenField.classList.toggle('hidden', typeSelect.value !== 'ngrok');
    });

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

            if (pieChart) {
                pieChart.data.datasets[0].data = [stats.running, stats.starting, stats.error, stats.stopped];
                pieChart.update();
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchTunnels = async () => {
        try {
            const response = await fetch('/api/tunnels');
            const tunnels = await response.json();

            if (!tunnelGrid) return;

            tunnelGrid.innerHTML = tunnels.map(t => `
                <div class="card p-6 flex flex-col space-y-6 relative group overflow-visible">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center space-x-3">
                            <div class="w-2 h-2 rounded-full status-${t.status.toLowerCase()} shadow-lg animate-pulse"></div>
                            <h3 class="text-base font-black text-white truncate max-w-[150px]">${t.name}</h3>
                        </div>

                        <div class="relative dropdown-container">
                            <button onclick="toggleDropdown(event, '${t.id}')" class="p-2 text-[#8b949e] hover:text-white rounded-lg hover:bg-[#21262d] transition-all">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                            </button>
                            <div id="dropdown-${t.id}" class="hidden absolute right-0 mt-2 w-48 dropdown-menu rounded-xl py-2 overflow-hidden">
                                <a href="#" class="block px-4 py-2 text-xs font-semibold text-white dropdown-item">Edit</a>
                                <a href="#" onclick="stopTunnel('${t.id}')" class="block px-4 py-2 text-xs font-semibold text-white dropdown-item">Stop</a>
                                <a href="#" class="block px-4 py-2 text-xs font-semibold text-white dropdown-item">Start</a>
                                <a href="#" class="block px-4 py-2 text-xs font-semibold text-white dropdown-item">Restart</a>
                                <div class="border-t border-[#30363d] my-1"></div>
                                <a href="#" class="block px-4 py-2 text-xs font-semibold text-white dropdown-item">Logs</a>
                                <a href="#" onclick="deleteTunnel('${t.id}')" class="block px-4 py-2 text-xs font-semibold text-red-400 dropdown-item">Delete</a>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-between items-center">
                        <div class="flex items-center text-xs font-bold text-[#8b949e]">
                            <svg class="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            <span>${t.local_addr}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-[#21262d] text-[#a371f7] text-[9px] font-black uppercase tracking-widest border border-[#30363d]">
                            ${t.type}
                        </span>
                    </div>

                    <div class="flex justify-between items-center bg-[#0b0d11] p-3 rounded-xl border border-[#21262d]">
                        <div class="flex items-center text-[11px] font-medium text-[#58a6ff] truncate mr-4">
                            <a href="${t.public_url}" target="_blank" class="hover:underline">${t.public_url || 'Allocating...'}</a>
                        </div>
                        <a href="${t.public_url}" target="_blank" class="text-[10px] font-black text-white uppercase tracking-wider hover:text-[#a371f7] transition-colors">Visit</a>
                    </div>
                </div>
            `).join('');
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
        const data = Object.fromEntries(formData.entries());

        if (!data.local_addr.includes(':')) {
            data.local_addr = `localhost:${data.local_addr}`;
        }

        const response = await fetch('/api/tunnels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            document.getElementById('add-modal').classList.add('hidden');
            tunnelForm.reset();
            fetchTunnels();
            updateStats();
        } else {
            const err = await response.text();
            alert('Deployment failed: ' + err);
        }
    });

    window.stopTunnel = async (id) => {
        const response = await fetch('/api/tunnels/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (response.ok) {
            fetchTunnels();
            updateStats();
        }
    };

    window.deleteTunnel = window.stopTunnel; // Simplification for demo

    // Initial load and polling
    fetchTunnels();
    updateStats();
    setInterval(() => {
        fetchTunnels();
        updateStats();
    }, 5000);
});
