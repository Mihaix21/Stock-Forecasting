async function apiFetch(url, options = {}) {
  const resp = await fetch(url, { credentials: "include", ...options });
  return resp;
}

document.addEventListener('DOMContentLoaded', () => {
  const toast      = document.getElementById('addToast');
  const closeBtn   = document.getElementById('toastClose');
  const addAnother = document.getElementById('addAnother');
  const manualForm = document.getElementById('stockHistoryForm');
  const importForm = document.getElementById('importForm');

  const dropZone    = document.getElementById('fileDropZone');
  const fileInput   = document.getElementById('importFile');
  const dropText    = document.getElementById('dropText');
  const fileNameDisplay = document.getElementById('fileName');
  const importBtn   = document.getElementById('importBtn'); // Butonul Submit
  const cloudIcon   = document.querySelector('.cloud-icon');

  if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      ['dragenter', 'dragover'].forEach(eventName => {
          dropZone.addEventListener(eventName, (e) => {
              e.preventDefault(); e.stopPropagation();
              dropZone.classList.add('drag-over');
          });
      });

      ['dragleave', 'drop'].forEach(eventName => {
          dropZone.addEventListener(eventName, (e) => {
              e.preventDefault(); e.stopPropagation();
              dropZone.classList.remove('drag-over');
          });
      });

      dropZone.addEventListener('drop', (e) => {
          const files = e.dataTransfer.files;
          if (files.length > 0) {
              fileInput.files = files;
              handleFileSelect(files[0]);
          }
      });

      fileInput.addEventListener('change', () => {
          if (fileInput.files.length > 0) {
              handleFileSelect(fileInput.files[0]);
          }
      });
  }

  function handleFileSelect(file) {
      fileNameDisplay.textContent = `📄 Selected: ${file.name}`;
      fileNameDisplay.hidden = false;
      dropText.style.display = 'none';
      cloudIcon.innerHTML = '✅';
      dropZone.classList.add('file-selected');
      importBtn.disabled = false;
  }

  const openBtn    = document.getElementById('openDatesModal');
  const datesModal = document.getElementById('datesModal');
  const datesClose = document.getElementById('datesClose');
  const genBtn     = document.getElementById('generateHistoryInModal');
  const modalTable = document.getElementById('modalHistoryTable');
  const formTable  = document.getElementById('formHistoryTable');

  if(openBtn) {
      openBtn.addEventListener('click', () => datesModal.classList.remove('modal-hidden'));
      datesClose.addEventListener('click', () => datesModal.classList.add('modal-hidden'));
      window.addEventListener('click', e => {
          if (e.target === datesModal) datesModal.classList.add('modal-hidden');
      });
  }

  if(genBtn) {
      genBtn.addEventListener('click', () => {
        const start = document.getElementById('modal_start_date').value;
        const end   = document.getElementById('modal_end_date').value;
        if (!start || !end || end < start) return alert('Selectează un interval valid.');

        const from = new Date(start), to = new Date(end), days = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate()+1)) {
          days.push(new Date(d));
        }

        let html = `<table class="hist-table">
          <thead><tr><th>Date</th><th>Sales</th><th>Stock</th></tr></thead>
          <tbody>`;
        days.forEach(dt => {
          html += `<tr>
            <td>${dt.toISOString().slice(0,10)}</td>
            <td><input type="number" name="daily_sales" min="0" value="0"></td>
            <td><input type="number" name="stock_level" min="0" value="0"></td>
          </tr>`;
        });
        html += `</tbody></table>
        <div style="margin-top:15px; text-align:right;">
             <button type="button" id="confirmDates" class="btn-primary" style="width:auto">Confirm Data</button>
        </div>`;

        modalTable.innerHTML = html;

        document.getElementById('confirmDates').addEventListener('click', () => {
            formTable.innerHTML = modalTable.innerHTML;
            formTable.querySelector('#confirmDates').remove();
            datesModal.classList.add('modal-hidden');
        });
      });
  }

  if(manualForm) {
      manualForm.addEventListener('submit', async e => {
        e.preventDefault();
        const name = manualForm.querySelector('[name="stock_name"]').value.trim();
        const minL = Number(manualForm.querySelector('[name="min_stock_level"]').value);
        const rows = Array.from(formTable.querySelectorAll('tbody tr'));

        if (!rows.length) return alert('Please generate history data first.');

        const history = rows.map(tr => ({
          date:           tr.cells[0].textContent,
          daily_sales:    Number(tr.querySelector('[name="daily_sales"]').value),
          stock_quantity: Number(tr.querySelector('[name="stock_level"]').value)
        }));

        try {
          const resp = await apiFetch('/api/stocks/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock_name: name, min_stock_level: minL, history })
          });
          if (!resp.ok) throw new Error(await resp.text());

          manualForm.reset();
          formTable.innerHTML = '';
          toast.classList.remove('toast-hidden');
        } catch (err) {
          alert('Error: ' + err.message);
        }
      });
  }

  if(importForm) {
      importForm.addEventListener('submit', async e => {
        e.preventDefault();
        const stockName = document.getElementById('import_stock_name').value.trim();
        const fileInput = document.getElementById('importFile');

        if (!stockName || !fileInput.files.length) return alert('Fill name & select file.');

        const fd = new FormData();
        fd.append('stock_name', stockName);
        fd.append('file', fileInput.files[0]);

        try {
          const resp = await apiFetch('/api/import-stocks/', { method: 'POST', body: fd });
          if (!resp.ok) throw new Error(await resp.text());

          importForm.reset();
          fileNameDisplay.hidden = true;
          dropText.style.display = 'block';
          cloudIcon.innerHTML = '☁️';
          dropZone.classList.remove('file-selected');
          importBtn.disabled = true;

          toast.classList.remove('toast-hidden');
        } catch (err) {
          alert('Import Error: ' + err.message);
        }
      });
  }

  const hideToast = () => toast.classList.add('toast-hidden');
  if(closeBtn) closeBtn.addEventListener('click', hideToast);
  if(addAnother) addAnother.addEventListener('click', hideToast);

  const infoBtn   = document.getElementById('excelInfoBtn');
  const infoModal = document.getElementById('excelInfoTip');
  const infoClose = document.getElementById('excelInfoClose');
  if(infoBtn) {
      infoBtn.addEventListener('click', () => infoModal.classList.remove('toast-hidden'));
      infoClose.addEventListener('click', () => infoModal.classList.add('toast-hidden'));
      window.addEventListener('click', e => { if (e.target === infoModal) infoModal.classList.add('toast-hidden'); });
  }
});