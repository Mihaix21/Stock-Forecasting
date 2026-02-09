document.addEventListener("DOMContentLoaded", () => {
    if(document.querySelector('.stats-container')) {
        initDashboardData();
    }
    checkAccountStatus();
    initProfileDropdown();
});

function initProfileDropdown() {
    const profileBtn = document.getElementById('profile_btn');
    const dropdown = document.getElementById('profile_dropdown');

    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Oprește evenimentul să ajungă la window
            dropdown.classList.toggle('show');
        });
        window.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
}


async function initDashboardData() {
    try {
        const response = await fetch("/api/manage_stocks");
        if (!response.ok) throw new Error("Network error");

        const stocks = await response.json();


        const totalProducts = stocks.length;

        const totalVolume = stocks.reduce((sum, stock) => {
            if (stock.history && stock.history.length > 0) {
                const lastRecord = stock.history[stock.history.length - 1];
                return sum + (lastRecord.stock_quantity || 0);
            }
            return sum;
        }, 0);

        const overstockCount = stocks.filter(s => {
            if (!s.history || s.history.length === 0) return false;
            const current = s.history[s.history.length - 1].stock_quantity;
            return current > (s.min_stock_level * 2);
        }).length;

        updateStatCard(0, totalProducts);
        updateStatCard(1, totalVolume.toLocaleString() + " pcs");
        updateStatCard(2, overstockCount + " Items");

        populateTable(stocks);
        setupFilters(stocks);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

function updateStatCard(cardIndex, value) {
    const cards = document.querySelectorAll(".stat-card");
    if (cards[cardIndex]) {
        const numberEl = cards[cardIndex].querySelector(".stat-number");
        if (numberEl) numberEl.textContent = value;
    }
}

function populateTable(stocks) {
    const tbody = document.querySelector(".dashboard-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    stocks.forEach(stock => {
        const tr = document.createElement("tr");

        let lastDate = "N/A";
        let statusClass = "success";
        let statusText = "Active";

        if (stock.history && stock.history.length > 0) {
            lastDate = stock.history[stock.history.length - 1].date;
        }

        if (!stock.is_active) {
            statusClass = "warning";
            statusText = "Inactive";
        }

        tr.innerHTML = `
            <td><strong>${stock.stock_name}</strong></td>
            <td><span class="btn-small-action">View</span></td>
            <td>${lastDate}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function setupFilters(stocks) {
    const searchInput = document.getElementById("filterSearch");
    const statusSelect = document.getElementById("filterStatus");

    if(!searchInput || !statusSelect) return;

    const filterData = () => {
        const term = searchInput.value.toLowerCase();
        const status = statusSelect.value;

        const filtered = stocks.filter(s => {
            const matchesName = s.stock_name.toLowerCase().includes(term);
            let matchesStatus = true;
            const isActive = s.is_active !== false;

            if (status === "Active") matchesStatus = isActive;
            if (status === "Inactive") matchesStatus = !isActive;

            return matchesName && matchesStatus;
        });
        populateTable(filtered);
    };

    searchInput.addEventListener("input", filterData);
    statusSelect.addEventListener("change", filterData);
}


function checkAccountStatus() {
    fetch('/api/settings/me/', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data && data.deletion_pending) {

                const currentPath = window.location.pathname.replace(/\/$/, ""); // Scoate slash final pt siguranță

                if (currentPath !== '/dashboard' && !currentPath.includes('/logout')) {
                    // Redirect forțat înapoi la Dashboard
                    window.location.href = '/dashboard';
                    return; // Oprim execuția aici
                }
                startRestrictedSession(data.days_left);
            }
        })
        .catch(err => console.error("Could not check account status", err));
}

function startRestrictedSession(days) {
    document.body.classList.add('interface-locked');

    const banner = document.createElement('div');
    banner.className = 'deletion-banner';
    document.body.prepend(banner);

    banner.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
            <span>⚠️ <strong>ACCOUNT DELETION PENDING</strong> (${days} days left)</span>
            <span style="font-size:12px;">
                Restricted Mode: Auto-logout in <strong id="countdownTimer">3:00</strong>.
            </span>
        </div>
        
        <div style="display:flex; gap:10px; margin-left:20px;">
            <button id="contactRestoreBtn" class="btn-restore-action">
                Cancel Deletion
            </button>
            <button id="bannerLogoutBtn" class="btn-logout-banner">
                Log Out
            </button>
        </div>
    `;

    const contactBtn = document.getElementById('contactRestoreBtn');
    const devModal = document.getElementById('devModal');
    if (contactBtn && devModal) {
        contactBtn.onclick = () => {
            const modalTitle = devModal.querySelector('h3');
            const originalTitle = modalTitle ? modalTitle.innerText : "Contact";
            if(modalTitle) modalTitle.innerText = "Restore Account";

            const modalBody = devModal.querySelector('.dev-body p strong');
            const originalBody = modalBody ? modalBody.innerText : "";
            if(modalBody) modalBody.innerText = "To cancel deletion, please email me directly.";

            devModal.classList.remove('modal-hidden');

            const closeBtn = document.getElementById('closeDevModal');
            if(closeBtn) {
                closeBtn.onclick = () => {
                    devModal.classList.add('modal-hidden');
                    setTimeout(() => {
                        if(modalTitle) modalTitle.innerText = originalTitle;
                        if(modalBody) modalBody.innerText = originalBody;
                    }, 500);
                };
            }
        };
    }

    const logoutBtn = document.getElementById('bannerLogoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            window.location.href = "/logout";
        };
    }

    let timeLeft = 180;
    const timerSpan = document.getElementById('countdownTimer');

    const updateTimerText = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        if(timerSpan) timerSpan.textContent = timeString;
    };

    const timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerText();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            window.location.href = "/logout";
        }
    }, 1000);
}