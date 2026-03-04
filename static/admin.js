'use strict';
    /* ─────────────────────────────────────────────────────
       CONFIG
    ───────────────────────────────────────────────────── */
    const API = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE !== undefined) ? CONFIG.API_BASE : 'http://localhost:8000';
    const ADMIN_EMAILS = (typeof CONFIG !== 'undefined' && CONFIG.ADMIN_EMAILS) ? CONFIG.ADMIN_EMAILS : ['kparitosh760@gmail.com'];
    const ADMIN_EMAIL = ADMIN_EMAILS[0]; // kept for legacy references
    const CLIENT_ID = (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_CLIENT_ID) ? CONFIG.GOOGLE_CLIENT_ID : '';

    let adminUser = null;
    let pendingDeleteId = null;

    // Display configured admin email in gate
    //document.getElementById('gate-admin-email-display').textContent = ADMIN_EMAIL;

    /* ─────────────────────────────────────────────────────
       SCROLL PROGRESS
    ───────────────────────────────────────────────────── */
    window.addEventListener('scroll', () => {
      const pct = document.documentElement.scrollHeight - innerHeight;
      document.getElementById('scroll-progress').style.width = pct > 0 ? (scrollY / pct * 100) + '%' : '0%';
    }, { passive: true });

    /* ─────────────────────────────────────────────────────
       TOAST
    ───────────────────────────────────────────────────── */
    function showToast(msg, type = 'info', duration = 4000) {
      const icons = { success: '✅', error: '❌', info: '✨' };
      const tc = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      el.setAttribute('role', 'alert');
      el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span><button class="toast-close" aria-label="Dismiss">×</button>`;
      el.querySelector('.toast-close').onclick = () => el.remove();
      tc.appendChild(el);
      setTimeout(() => el.remove(), duration);
    }

    /* ─────────────────────────────────────────────────────
       JWT DECODE
    ───────────────────────────────────────────────────── */
    function parseJwt(token) {
      try {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(b64));
      } catch { return null; }
    }

    /* ─────────────────────────────────────────────────────
       GOOGLE AUTH
    ───────────────────────────────────────────────────── */
    function initGoogleAuth() {
      if (!CLIENT_ID || CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
        document.getElementById('gate-error').textContent =
          '⚠️ Google Client ID is not configured in config.js. Please set it up first.';
        document.getElementById('gate-error').classList.add('visible');
        return;
      }

      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleAdminCredential,
        auto_select: false,
      });

      // Render the official Google button immediately on load
      google.accounts.id.renderButton(
        document.getElementById('google-btn-container'),
        { theme: 'outline', size: 'large', width: 320 }
      );
    }
    function handleAdminCredential(response) {
      const payload = parseJwt(response.credential);
      if (!payload) { showGateError('Sign-in failed. Please try again.'); return; }

      if (!ADMIN_EMAILS.includes(payload.email)) {
        showGateError(
          `Access denied. This panel is only accessible to ADMIN. You signed in as ${payload.email}.`
        );
        // Revoke immediately
        google.accounts.id.revoke(payload.email, () => { });
        return;
      }

      // Auth successful
      adminUser = { name: payload.name, email: payload.email, picture: payload.picture };
      sessionStorage.setItem('admin_user', JSON.stringify(adminUser));
      activateAdminPanel();
    }

    function showGateError(msg) {
      const el = document.getElementById('gate-error');
      el.textContent = msg;
      el.classList.add('visible');
    }
    // Profile Dropdown logic
    document.getElementById('profile-btn').addEventListener('click', () => {
      const dd = document.getElementById('profile-dropdown');
      const btn = document.getElementById('profile-btn');
      const isHidden = dd.classList.contains('hidden');

      if (isHidden) {
        dd.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        dd.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('#profile-wrapper')) {
        document.getElementById('profile-dropdown').classList.add('hidden');
        document.getElementById('profile-btn').setAttribute('aria-expanded', 'false');
      }
    });

    function activateAdminPanel() {
      document.getElementById('auth-gate').classList.add('hidden');
      document.getElementById('admin-app').classList.remove('hidden');

      // Render profile in nav
      const img = document.getElementById('admin-avatar-img');
      const ph = document.getElementById('admin-avatar-ph');
      if (adminUser.picture) {
        img.src = adminUser.picture; img.style.display = ''; ph.style.display = 'none';
      } else {
        ph.textContent = adminUser.name[0]; ph.style.display = '';
      }
      document.getElementById('admin-name-text').textContent = adminUser.name.split(' ')[0];
      document.getElementById('dd-admin-name').textContent = adminUser.name;
      document.getElementById('dd-admin-email').textContent = adminUser.email;
      
      loadAdminCompanies();
      loadAdminJobs();
      showToast(`Welcome, ${adminUser.name.split(' ')[0]} 👋`, 'success');
    }

    function adminSignOut() {
      if (CLIENT_ID && !CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
        google.accounts.id.revoke(adminUser?.email || '', () => { });
      }
      adminUser = null;
      sessionStorage.removeItem('admin_user');
      document.getElementById('admin-app').classList.add('hidden');
      document.getElementById('auth-gate').classList.remove('hidden');
      document.getElementById('gate-error').classList.remove('visible');
      showToast('Signed out', 'info', 2000);
    }

    document.getElementById('admin-signout-btn').addEventListener('click', adminSignOut);

    /* ─────────────────────────────────────────────────────
       API HELPER
    ───────────────────────────────────────────────────── */
    async function apiFetch(path, opts = {}) {
      try {
        const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
        return res.json();
      } catch (e) {
        if (e.message === 'Failed to fetch') throw new Error('Cannot reach backend. Ensure FastAPI is running on port 8000.');
        throw e;
      }
    }
    /* ─────────────────────────────────────────────────────
   LOAD COMPANIES
───────────────────────────────────────────────────── */
    async function loadAdminCompanies(selectedId = null) {
      const select = document.getElementById('f-company-id');
      try {
        const data = await apiFetch('/companies');
        const companies = data.companies || [];

        if (companies.length === 0) {
          select.innerHTML = '<option value="">No companies found. Create one first.</option>';
        } else {
          select.innerHTML = '<option value="">Select a company</option>' +
            companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        // Auto-select if an ID was passed (useful after creating a new company)
        if (selectedId) {
          select.value = selectedId;
        }
      } catch (e) {
        select.innerHTML = '<option value="">⚠️ Error loading companies</option>';
        console.error(e);
      }
    }

    /* ─────────────────────────────────────────────────────
       LOAD & RENDER JOBS
    ───────────────────────────────────────────────────── */
    async function loadAdminJobs() {
      const grid = document.getElementById('admin-jobs-grid');
      grid.innerHTML = Array(4).fill(`
    <div class="sk-card" aria-hidden="true">
      <div class="sk sk-t"></div><div class="sk sk-s"></div>
    </div>`).join('');

      try {
        const data = await apiFetch('/jobs?page_size=50&active_only=false');
        const jobs = data.jobs || [];
        document.getElementById('admin-jobs-count').textContent = `${jobs.length} listing${jobs.length !== 1 ? 's' : ''}`;

        if (!jobs.length) {
          grid.innerHTML = `<div class="no-jobs">No listings yet. Post your first job!</div>`;
          return;
        }
        grid.innerHTML = jobs.map(job => adminJobCardHTML(job)).join('');
        attachAdminCardEvents();
      } catch (e) {
        grid.innerHTML = `<div class="no-jobs" style="color:var(--red)">${e.message}</div>`;
        showToast(e.message, 'error');
      }
    }

    function adminJobCardHTML(job) {
      const company = job.company || {};
      const salary = job.salary_min ? `₹${(job.salary_min / 1000).toFixed(0)}k${job.salary_max ? `–₹${(job.salary_max / 1000).toFixed(0)}k` : ''}` : '—';
      const isActive = job.is_active !== false;
      return `
  <div class="admin-job-card" role="listitem" data-job-id="${job.id}" aria-label="${job.title}">
    <div class="job-card-left">
      <div class="job-card-title" title="${job.title}">${job.title}</div>
      <div class="job-card-meta">
        <span>${company.name || '—'}</span>
        <span>${job.location || '—'}</span>
        <span>${salary}</span>
        <span>${job.applications_count || 0} applied</span>
      </div>
      <div class="job-card-tags">
        <span class="job-tag job-tag-type">${job.job_type || '—'}</span>
        <span class="job-tag job-tag-cat">${job.category || '—'}</span>
        ${!isActive ? '<span class="job-tag" style="background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.2)">Inactive</span>' : ''}
      </div>
    </div>
    <div class="job-card-actions">
      <button class="job-toggle-btn${isActive ? ' active' : ''}"
        data-job-id="${job.id}" data-active="${isActive}"
        aria-label="${isActive ? 'Deactivate' : 'Activate'} listing"
        aria-pressed="${isActive}">
        ${isActive ? '● Active' : '○ Inactive'}
      </button>
      <button class="delete-btn" data-job-id="${job.id}" data-job-title="${job.title}" aria-label="Delete ${job.title}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  </div>`;
    }

    function attachAdminCardEvents() {
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openConfirm(btn.dataset.jobId, btn.dataset.jobTitle));
      });
      document.querySelectorAll('.job-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleJobActive(btn.dataset.jobId, btn.dataset.active === 'true'));
      });
    }

    /* ─────────────────────────────────────────────────────
       TOGGLE JOB ACTIVE
    ───────────────────────────────────────────────────── */
    async function toggleJobActive(jobId, currentlyActive) {
      try {
        await apiFetch(`/jobs/${jobId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: !currentlyActive })
        });
        showToast(`Listing ${!currentlyActive ? 'activated' : 'deactivated'} successfully`, 'success', 2500);
        loadAdminJobs();
      } catch (e) {
        showToast(e.message, 'error');
      }
    }

    /* ─────────────────────────────────────────────────────
       DELETE JOB
    ───────────────────────────────────────────────────── */
    function openConfirm(jobId, jobTitle) {
      pendingDeleteId = jobId;
      document.getElementById('confirm-sub').textContent = `"${jobTitle}" will be permanently removed. This cannot be undone.`;
      document.getElementById('confirm-overlay').classList.remove('hidden');
    }
    function closeConfirm() {
      pendingDeleteId = null;
      document.getElementById('confirm-overlay').classList.add('hidden');
    }
    document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
    document.getElementById('confirm-delete').addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      const btn = document.getElementById('confirm-delete');
      btn.disabled = true; btn.textContent = 'Deleting…';
      try {
        await apiFetch(`/jobs/${pendingDeleteId}`, { method: 'DELETE' });
        closeConfirm();
        showToast('Job listing deleted', 'success', 3000);
        loadAdminJobs();
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false; btn.textContent = 'Yes, Delete';
      }
    });
    document.getElementById('confirm-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeConfirm();
    });

    /* ─────────────────────────────────────────────────────
       POST JOB FORM
    ───────────────────────────────────────────────────── */
    document.getElementById('refresh-jobs-btn').addEventListener('click', loadAdminJobs);

    function parseLines(str) {
      return str.split('\n').map(s => s.trim()).filter(Boolean);
    }

    document.getElementById('post-job-form').addEventListener('submit', async e => {
      e.preventDefault();

      // Validate required fields
      const required = [
        ['f-company-id', 'err-company-id'],
        ['f-title', 'err-title'],
        ['f-category', 'err-category'],
        ['f-job-type', 'err-job-type'],
        ['f-exp-level', 'err-exp-level'],
        ['f-location', 'err-location'],
        ['f-desc', 'err-desc'],
      ];
      let valid = true;
      required.forEach(([fId, eId]) => {
        const f = document.getElementById(fId);
        const e = document.getElementById(eId);
        if (!f.value.trim()) {
          f.classList.add('error'); e.classList.remove('hidden'); valid = false;
        } else {
          f.classList.remove('error'); e.classList.add('hidden');
        }
      });
      if (!valid) { showToast('Please fill in all required fields', 'error', 3000); return; }

      const btn = document.getElementById('post-submit-btn');
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner" aria-label="Posting…"></div> Publishing…`;

      const salMin = parseInt(document.getElementById('f-sal-min').value) || null;
      const salMax = parseInt(document.getElementById('f-sal-max').value) || null;
      const deadline = document.getElementById('f-deadline').value || null;
      const openings = parseInt(document.getElementById('f-openings').value) || 1;
      const tagsRaw = document.getElementById('f-tags').value;
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

      const payload = {
        company_id: document.getElementById('f-company-id').value.trim(),
        title: document.getElementById('f-title').value.trim(),
        category: document.getElementById('f-category').value,
        job_type: document.getElementById('f-job-type').value,
        experience_level: document.getElementById('f-exp-level').value,
        location: document.getElementById('f-location').value.trim(),
        is_remote: document.getElementById('f-remote').checked,
        description: document.getElementById('f-desc').value.trim(),
        responsibilities: parseLines(document.getElementById('f-responsibilities').value),
        requirements: parseLines(document.getElementById('f-requirements').value),
        nice_to_have: parseLines(document.getElementById('f-nice').value),
        salary_min: salMin,
        salary_max: salMax,
        salary_currency: 'INR',
        application_deadline: deadline,
        openings,
        tags,
      };

      try {
        const result = await apiFetch('/jobs', { method: 'POST', body: JSON.stringify(payload) });
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Publish Job Listing`;

        document.getElementById('post-job-form').reset();
        const banner = document.getElementById('post-success-banner');
        document.getElementById('post-success-msg').textContent =
          `"${result.job?.title || payload.title}" published successfully!`;
        banner.classList.remove('hidden');
        setTimeout(() => banner.classList.add('hidden'), 5000);

        showToast(`"${payload.title}" is now live! 🎉`, 'success', 4000);
        loadAdminJobs();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Publish Job Listing`;
        showToast(err.message, 'error', 5000);
      }
    });

    /* ─────────────────────────────────────────────────────
       CREATE COMPANY MODAL
    ───────────────────────────────────────────────────── */
    function showCreateCompanyTip() {
      document.getElementById('company-modal').classList.remove('hidden');
    }

    function closeCompanyModal() {
      document.getElementById('company-modal').classList.add('hidden');
    }

    document.getElementById('company-modal-close').addEventListener('click', closeCompanyModal);

    document.getElementById('create-company-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('company-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      const payload = {
        name: document.getElementById('c-name').value.trim(),
        industry: document.getElementById('c-industry').value.trim(),
        location: document.getElementById('c-location').value.trim(),
        website: document.getElementById('c-website').value.trim() || undefined
      };

      try {
        const res = await apiFetch('/companies', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Company created successfully!', 'success');

        // Refresh the dropdown and auto-select the newly created company
        await loadAdminCompanies(res.id);

        closeCompanyModal();
        e.target.reset(); // Clear the form for next time
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Company & Auto-fill ID';
      }
    });

    /* ─────────────────────────────────────────────────────
       INIT
    ───────────────────────────────────────────────────── */
    // Restore session if admin signed in earlier
    const savedAdmin = sessionStorage.getItem('admin_user');
    if (savedAdmin) {
      try {
        adminUser = JSON.parse(savedAdmin);
        // Verify it's still the right person
        if (ADMIN_EMAILS.includes(adminUser.email)) {
          activateAdminPanel();
        } else {
          sessionStorage.removeItem('admin_user');
          adminUser = null;
        }
      } catch { sessionStorage.removeItem('admin_user'); }
    }

    // Init Google GIS once loaded
    window.addEventListener('load', () => {
      const tryInit = () => {
        if (typeof google !== 'undefined' && google.accounts) {
          initGoogleAuth();
        } else {
          setTimeout(tryInit, 200);
        }
      };
      tryInit();
    });