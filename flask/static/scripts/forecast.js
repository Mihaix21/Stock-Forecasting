let myChart = null;

const apiFetch = (url, options = {}) =>
  fetch(url, { credentials: 'include', ...options });

function formatDateRO(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function normalizePlanResponse(json) {
  if (Array.isArray(json)) return { plan: json, summary: null };
  if (json && Array.isArray(json.plan)) return { plan: json.plan, summary: json.summary || null };
  return { plan: [], summary: null };
}

async function fetchAndSavePlan(stockId, months, review_days) {
  const resp = await apiFetch(`/api/forecast/${stockId}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ months, review_days })
  });
  if (!resp.ok) throw new Error(await resp.text());
  return normalizePlanResponse(await resp.json());
}

function renderForecastChart(planData) {
  const ctx = document.getElementById('forecastChart');
  if (!ctx) return;

  if (myChart) {
    myChart.destroy();
  }

  const labels = planData.map(item => formatDateRO(item.review_date).slice(0, 5)); // Doar Zi.Lună
  const stockData = planData.map(item => Math.round(item.stock_before));
  const demandData = planData.map(item => Math.round(item.demand_next));

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Estimated Stock Level',
          data: stockData,
          borderColor: '#1787A2',
          backgroundColor: 'rgba(23, 135, 162, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#1787A2'
        },
        {
          label: 'Predicted Demand',
          data: demandData,
          borderColor: '#F59E0B',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#F59E0B'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#111',
          bodyColor: '#333',
          borderColor: '#ddd',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Quantity (Units)' },
          grid: { borderDash: [2, 4], color: '#f0f0f0' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}


document.addEventListener('DOMContentLoaded', () => {

  const selectProduct = document.getElementById('selectProduct');
  apiFetch('/api/stocks/')
    .then(async r => {
      if (!r.ok) throw new Error(await r.text());
      const ct = r.headers.get('Content-Type') || '';
      const data = ct.includes('application/json') ? await r.json() : [];
      return Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
    })
    .then(items => {
      selectProduct.innerHTML = '<option value="">-- Choose a product --</option>';

      items.sort((a, b) => {
          const nA = a.stock_name || a.name || "";
          const nB = b.stock_name || b.name || "";
          return nA.localeCompare(nB);
      });

      const frag = document.createDocumentFragment();
      items.forEach(p => frag.appendChild(new Option(p.stock_name || p.name || `#${p.id}`, p.id)));
      selectProduct.appendChild(frag);
    })
    .catch(() => {
        selectProduct.innerHTML = '<option value="">Error loading products</option>';
    });

  const downloadBtn = document.getElementById('downloadExcelBtn');
  if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
          const table = document.getElementById('planTable');
          if (!table) return;

          let csvContent = [];

          const headers = [];
          table.querySelectorAll('thead th').forEach(th => headers.push(th.innerText));
          csvContent.push(headers.join(","));

          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
              const cols = row.querySelectorAll('td');
              const rowData = [];
              cols.forEach(col => {
                  let text = col.innerText.replace(/,/g, "").trim();
                  rowData.push(text);
              });
              csvContent.push(rowData.join(","));
          });

          const csvString = csvContent.join("\n");
          const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.setAttribute("href", url);

          const prodName = selectProduct.options[selectProduct.selectedIndex]?.text || "Forecast";
          const cleanName = prodName.replace(/[^a-z0-9]/gi, '_');
          link.setAttribute("download", `Forecast_${cleanName}.csv`);

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      });
  }

  const form       = document.getElementById('forecastForm');
  const resultSec  = document.getElementById('forecastResult');
  const initialState = document.getElementById('initialState');
  const ptBody     = document.querySelector('#planTable tbody');
  const spinner    = document.getElementById('loadingSpinner');
  const runBtn     = document.getElementById('runForecastBtn');
  const summaryBox = document.getElementById('forecastSummary');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const pid         = selectProduct.value;
    const months      = Number(form.months.value);
    const review_days = Number(form.review_days.value);

    if (!pid) return alert('Selectează un produs.');

    spinner.hidden   = false;
    runBtn.disabled  = true;
    const originalBtnText = runBtn.innerHTML;
    runBtn.innerHTML = '⏳ Processing...';

    resultSec.hidden = true;
    initialState.hidden = true;

    summaryBox.innerHTML = '';
    ptBody.innerHTML = '';

    try {
      const { plan, summary } = await fetchAndSavePlan(pid, months, review_days);

      if (plan.length === 0) {
          ptBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No restock needed for this period.</td></tr>';
      } else {
          plan.forEach(r => {
            const prettyDate = formatDateRO(r.review_date);
            ptBody.insertAdjacentHTML('beforeend', `
              <tr>
                <td><strong>${prettyDate}</strong></td>
                <td>${Math.round(r.stock_before)}</td>
                <td>${Math.round(r.demand_next)}</td>
                <td style="color:${r.order_qty > 0 ? '#1787A2' : '#ccc'}; font-weight:bold;">
                    ${Math.round(r.order_qty)}
                </td>
              </tr>
            `);
          });
      }

      if (summary) {
        const nextDate = formatDateRO(summary.next_review_date);
        summaryBox.innerHTML = `
          <div class="forecast-summary-card">
            <ul>
              ${summary.next_review_date ? 
                  `<li><span>📅 First Order Date:</span> <b>${nextDate}</b></li>` : ''}
              
              ${typeof summary.total_order_qty === 'number' ? 
                  `<li><span>Total Quantity Needed:</span> <a>${Math.ceil(summary.total_order_qty)} pcs</a></li>` : ''}
              
              ${typeof summary.accuracy_pct === 'number' ? 
                   `<li><span>Confidence:</span> <span>${summary.accuracy_pct.toFixed(1)}%</span></li>` : ''}
            </ul>
          </div>
        `;
      } else {
          summaryBox.innerHTML = '<p style="color:#666; font-style:italic;">Forecast generated successfully.</p>';
      }

      if (plan.length > 0) {
        renderForecastChart(plan);
      }

      resultSec.hidden = false;

    } catch (err) {
      console.error(err);
      alert('Error generating forecast: ' + err.message);
      initialState.hidden = false;
    } finally {
      spinner.hidden   = true;
      runBtn.disabled  = false;
      runBtn.innerHTML = originalBtnText;
    }
  });
});