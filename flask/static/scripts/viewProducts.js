document.addEventListener('DOMContentLoaded', () => {
  const apiFetch = (url, options = {}) =>
    fetch(url, { credentials: 'include', ...options });

  const wrap          = document.getElementById('vp-cards');
  const editModal     = document.getElementById('editModal');
  const editClose     = document.getElementById('editClose');
  const editForm      = document.getElementById('editForm');
  const rowsContainer = document.getElementById('newHistoryRows');
  const addHistoryBtn = document.getElementById('addHistoryRow');

  apiFetch('/api/stocks/')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(list => {
      list.sort((a, b) => a.id - b.id);
      drawCards(list);
    })
    .catch(err => {
      console.error(err);
      wrap.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#EF4444;">Server error: Could not load products.</p>';
    });


  function drawCards(list) {
    wrap.innerHTML = '';

    const addCardHTML = `
      <div class="product-card add-new" onclick="window.location.href='/dashboard/modifyStocks'">
        <div class="add-icon">+</div>
        <h3>Add New Product</h3>
        <p>Create item or import Excel</p>
      </div>
    `;
    wrap.insertAdjacentHTML('beforeend', addCardHTML);

    if (!Array.isArray(list) || !list.length) return;

    list.forEach(p => wrap.insertAdjacentHTML('beforeend', cardHTML(p)));
  }

  function cardHTML(p) {
    const isActive = (p.is_active !== undefined) ? p.is_active : true;
    const checkAttr = isActive ? 'checked' : '';
    const statusText = isActive ? 'Active' : 'Inactive';

    return `
      <div class="product-card" id="card-${p.id}">
        
        <button class="edit-btn" data-id="${p.id}" title="Edit Product">✎</button>
        <button class="del-btn"  data-id="${p.id}" title="Delete Product">×</button>
        
        <h3>${p.stock_name}</h3>
        <p><strong>Min. stock:</strong> ${p.min_stock_level}</p>
        <p style="font-size:0.85rem; margin-top:5px; color:#6B7280;">
           Current: <span style="color:#111827; font-weight:600;">${p.current_stock_quantity || 0}</span>
        </p>

        <div class="status-toggle-wrapper">
            <span class="status-label">${statusText}</span>
            <label class="switch">
                <input type="checkbox" class="status-chk" data-id="${p.id}" ${checkAttr}>
                <span class="slider"></span>
            </label>
        </div>

      </div>`;
  }

  wrap.addEventListener('change', e => {
      if (e.target.classList.contains('status-chk')) {
          const id = e.target.dataset.id;
          const isActive = e.target.checked;
          const card = document.getElementById(`card-${id}`);
          const label = card.querySelector('.status-label');

          label.textContent = isActive ? 'Active' : 'Inactive';

          label.style.color = isActive ? '#1787A2' : '#9CA3AF';

          apiFetch(`/api/stocks/${id}/`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: isActive })
          })
          .then(r => {
              if (!r.ok) {
                  // Revert
                  e.target.checked = !isActive;
                  label.textContent = !isActive ? 'Active' : 'Inactive';
                  alert("Failed to update status on server.");
              }
          })
          .catch(err => console.error(err));
      }
  });

  wrap.addEventListener('click', e => {
    const del = e.target.closest('.del-btn');
    if (del) {
      const id = del.dataset.id;
      if (!confirm('Delete this product?')) return;
      apiFetch(`/api/stocks/${id}/`, { method: 'DELETE' }).then(r => {
          if (!r.ok) throw new Error(r.status);
          const card = document.getElementById(`card-${id}`);
          if(card) card.remove();
      }).catch(alert);
      return;
    }

    const edt = e.target.closest('.edit-btn');
    if (edt) {
      const id = edt.dataset.id;
      apiFetch(`/api/stocks/${id}/`).then(r=>r.json()).then(p=>{
          editForm.edit_id.value = p.id;
          editForm.edit_stock_name.value = p.stock_name;
          editForm.edit_min_stock.value = p.min_stock_level;
          rowsContainer.innerHTML = '';
          if(p.history) p.history.forEach(rec => {
             const div = document.createElement('div');
             div.classList.add('hist-row');
             div.innerHTML = `<input type="date" name="date" value="${rec.date}"><input type="number" name="daily_sales" value="${rec.daily_sales}"><input type="number" name="stock_quantity" value="${rec.stock_quantity}">`;
             rowsContainer.append(div);
          });
          editModal.classList.add('show');
      });
    }
  });

  if(editClose) editClose.onclick = () => editModal.classList.remove('show');
  if(editForm) editForm.onsubmit = (e) => {
      e.preventDefault();
      const id = editForm.edit_id.value;
      const payload = {
          stock_name: editForm.edit_stock_name.value,
          min_stock_level: editForm.edit_min_stock.value,
          history: []
      };
  };
});