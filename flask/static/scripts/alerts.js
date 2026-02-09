document.addEventListener('DOMContentLoaded', () => {
  const apiFetch = (url, options = {}) =>
    fetch(url, { credentials: 'include', ...options });

  const container = document.getElementById('alertsContainer');
  if (!container) return;

  apiFetch('/api/alerts/')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(list => {

      container.innerHTML = '';

      const addCard = document.createElement('div');
      addCard.className = 'forecast-card add-new';
      addCard.onclick = () => window.location.href = '/dashboard/forecast';
      addCard.innerHTML = `
          <div class="add-icon">+</div>
          <h3>Run New Forecast</h3>
          <p>Generate demand plan for another product</p>
      `;
      container.appendChild(addCard);

      if (!Array.isArray(list) || !list.length) return;

      const groups = list.reduce((acc, item) => {
        const runId = item.run_id;
        if (!acc[runId]) acc[runId] = [];
        acc[runId].push(item);
        return acc;
      }, {});

      Object.entries(groups).forEach(([runId, items]) => {
        const stockName      = items[0].stock_name || "Unknown Product";
        const durationMonths = items[0].months != null ? items[0].months : '—';

        const card = document.createElement('div');
        card.classList.add('forecast-card');
        card.dataset.runId = runId;

        const tableRows = items.map(it => {
          const date = it.review_date
            ? new Date(it.review_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'2-digit', year:'numeric'})
            : '—';

          return `
            <tr>
              <td class="col-date">${date}</td>
              <td class="col-qty">${Math.round(it.order_qty)} pcs</td>
            </tr>`;
        }).join('');

        card.innerHTML = `
          <div class="card-header">
            
            <div class="header-content">
                <h4 class="card-title">${stockName}</h4>
                <div class="meta-info">
                    <span class="meta-tag">${durationMonths} Months Horizon</span>
                </div>
            </div>

            <div class="header-actions">
                <button class="download-card" title="Download Excel">
                    <img src="/static/imgs/download_icon.png" alt="Download">
                </button>
                <button class="del-card" title="Delete Forecast">&times;</button>
            </div>

          </div>

          <div class="card-body">
            <table class="mini-table">
                <thead>
                    <tr>
                        <th class="col-date">Review Date</th>
                        <th class="col-qty">Order Qty</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
          </div>
        `;

        container.insertBefore(card, container.children[1] || null);
      });
    })
    .catch(console.error);

  container.addEventListener('click', e => {

    const btnDel = e.target.closest('.del-card');
    if (btnDel) {
        const card  = btnDel.closest('.forecast-card');
        const runId = card.dataset.runId;

        if (!confirm('Are you sure you want to delete this forecast history?')) return;

        card.style.opacity = '0.5';
        apiFetch(`/api/alerts/run/${runId}/`, { method: 'DELETE' })
          .then(r => {
            if (r.status === 204) {
              card.style.transform = 'scale(0.9)';
              setTimeout(() => card.remove(), 200);
            } else {
              card.style.opacity = '1';
              throw new Error(`Server status: ${r.status}`);
            }
          })
          .catch(err => {
            card.style.opacity = '1';
            alert('Could not delete: ' + err.message);
          });
        return;
    }

    const btnDown = e.target.closest('.download-card');
    if (btnDown) {
        const card = btnDown.closest('.forecast-card');
        const stockName = card.querySelector('.card-title').innerText.trim();
        const table = card.querySelector('.mini-table');

        if (!table) return;

        let csvContent = [];

        csvContent.push("Review Date,Order Quantity");

        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            // Luăm textul și curățăm eventuale virgule sau "pcs"
            const date = cols[0].innerText.trim();
            const qty  = cols[1].innerText.replace('pcs', '').trim();

            csvContent.push(`${date},${qty}`);
        });

        const csvString = csvContent.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);

        const cleanName = stockName.replace(/[^a-z0-9]/gi, '_');
        link.setAttribute("download", `Forecast_History_${cleanName}.csv`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  });
});