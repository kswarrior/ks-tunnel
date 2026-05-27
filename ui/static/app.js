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
            document.getElementById(`section-${s}`).classList.add('hidden');
        });
        document.getElementById(`section-${sectionId}`).classList.remove('hidden');

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
    const ctx = document.getElementById('pieChart').getContext('2d');
    const pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Running', 'Starting', 'Error', 'Stopped'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#3fb950', '#d29922', '#f85149', '#484f58'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#c9d1d9', font: { family: 'Inter' } }
                }
            }
        }
    });

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

            document.getElementById('stat-total').innerText = stats.total;
            document.getElementById('stat-running').innerText = stats.running;
            document.getElementById('stat-starting').innerText = stats.starting;
            document.getElementById('stat-error').innerText = stats.error;

            pieChart.data.datasets[0].data = [stats.running, stats.starting, stats.error, stats.stopped];
            pieChart.update();
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchTunnels = async () => {
        try {
            const response = await fetch('/api/tunnels');
            const tunnels = await response.json();

            tunnelGrid.innerHTML = tunnels.map(t => `
                <div class="card p-6 flex flex-col justify-between space-y-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-bold text-white">${t.name}</h3>
                            <span class="text-[10px] uppercase tracking-widest text-[#8b949e] font-bold">${t.type}</span>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold status-${t.status.toLowerCase()}">
                            ${t.status}
                        </span>
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center text-xs text-[#8b949e]">
                            <svg class="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            <span>Local: ${t.local_addr}</span>
                        </div>
                        <div class="flex items-center text-sm font-medium text-[#58a6ff] truncate">
                            <svg class="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                            <a href="${t.public_url}" target="_blank" class="hover:underline">${t.public_url || 'Allocating...'}</a>
                        </div>
                    </div>

                    ${t.error ? `<div class="text-[10px] text-red-400 bg-red-900/20 p-2 rounded">${t.error}</div>` : ''}

                    <div class="flex justify-end space-x-2 pt-2">
                        <button onclick="stopTunnel('${t.id}')" class="p-2 text-[#8b949e] hover:text-red-500 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Failed to fetch tunnels:', err);
        }
    };

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

    // Initial load and polling
    fetchTunnels();
    updateStats();
    setInterval(() => {
        fetchTunnels();
        updateStats();
    }, 5000);
});
