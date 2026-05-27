document.addEventListener('DOMContentLoaded', () => {
    const tunnelList = document.getElementById('tunnel-list');
    const tunnelForm = document.getElementById('tunnel-form');
    const typeSelect = tunnelForm.querySelector('select[name="type"]');
    const ngrokTokenField = document.getElementById('ngrok-token-field');

    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'ngrok') {
            ngrokTokenField.classList.remove('hidden');
        } else {
            ngrokTokenField.classList.add('hidden');
        }
    });

    const fetchTunnels = async () => {
        const response = await fetch('/api/tunnels');
        const tunnels = await response.json();

        tunnelList.innerHTML = tunnels.map(t => `
            <tr class="border-b border-[#30363d] hover:bg-[#1c2128]">
                <td class="px-6 py-4 font-medium text-white">${t.name}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs font-semibold bg-[#21262d] text-[#8b949e]">
                        ${t.type.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs text-[#8b949e]">From: ${t.local_addr}</div>
                    <div class="text-sm text-[#58a6ff]">
                        <a href="${t.public_url}" target="_blank">${t.public_url || 'Pending...'}</a>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold status-${t.status.toLowerCase()}">
                        ${t.status}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <button onclick="stopTunnel('${t.id}')" class="text-[#f85149] hover:text-[#da3633]">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    tunnelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(tunnelForm);
        const data = Object.fromEntries(formData.entries());

        // Ensure port is handled correctly (e.g., :8080)
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
        } else {
            const err = await response.text();
            alert('Error: ' + err);
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
        }
    };

    fetchTunnels();
    setInterval(fetchTunnels, 3000);
});
