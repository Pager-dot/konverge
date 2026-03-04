'use strict';
/* ═══════════════════════════════════════════════════
   CONFIG & STATE
═══════════════════════════════════════════════════ */
const API       = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE !== undefined) ? CONFIG.API_BASE : 'http://localhost:8000';
const PAGE_SIZE = 10;

const state = {
  jobs:        [],
  total:       0,
  page:        1,
  totalPages:  1,
  hasMore:     true,
  loading:     false,
  loadingMore: false,
  filters:     {search:'',category:'',job_type:'',experience_level:'',location:'',is_remote:null,salary_min:''},
  sort:        'newest',
  bookmarks:   JSON.parse(localStorage.getItem('oh_bookmarks')  || '[]'),
  applications:JSON.parse(localStorage.getItem('oh_applications')|| '[]'),
  recentViewed:JSON.parse(localStorage.getItem('oh_recent')     || '[]'),
  currentJobId:null,
  currentJob:  null,
  applyStep:   1,
  googleUser:  JSON.parse(sessionStorage.getItem('oh_guser') || 'null'),
  pendingApplyJob: null, // job to open after sign-in
};

/* ═══════════════════════════════════════════════════
   GOOGLE IDENTITY SERVICES — AUTH
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   GOOGLE IDENTITY SERVICES — AUTH
   ─────────────────────────────────────────────────
   We use renderButton() NOT prompt()/One Tap.
   One Tap is blocked by many browsers and fails
   silently. renderButton() renders Google's own
   iframe button which always works via popup.
═══════════════════════════════════════════════════ */

function parseJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(atob(b64));
  } catch { return null; }
}

/** Called by Google GIS after sign-in completes */
function handleGoogleCredential(response) {
  const payload = parseJwt(response.credential);
  if (!payload) { showToast('Sign-in failed — please try again.', 'error'); return; }

  state.googleUser = {
    name:    payload.name,
    email:   payload.email,
    picture: payload.picture,
    sub:     payload.sub,
  };
  sessionStorage.setItem('oh_guser', JSON.stringify(state.googleUser));
  renderAuthUI();
  closeAuthGate();

  if (state.pendingApplyJob) {
    const job = state.pendingApplyJob;
    state.pendingApplyJob = null;
    _doOpenApplyModal(job);
  }
  updateAppsIndicator();
  loadStats(); // refresh so Applications stat shows user's own count
  showToast(`Welcome, ${state.googleUser.name.split(' ')[0]}! 👋`, 'success');
}

/** Render Google's real button into a container element.
 *  Using renderButton() avoids all One Tap browser restrictions. */
function renderGoogleButton(containerEl) {
  if (!containerEl || typeof google === 'undefined' || !google.accounts) return;
  const clientId = (typeof CONFIG !== 'undefined') ? CONFIG.GOOGLE_CLIENT_ID : '';
  if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) return;
  containerEl.innerHTML = ''; // clear old iframe if any
  google.accounts.id.renderButton(containerEl, {
    theme: 'outline', size: 'large', width: 300, text: 'continue_with',
  });
}

/** Initialize GIS once the script has loaded */
function initGoogleAuth() {
  const clientId = (typeof CONFIG !== 'undefined') ? CONFIG.GOOGLE_CLIENT_ID : '';
  if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
    console.warn('CareerNest: Set GOOGLE_CLIENT_ID in config.js');
    return;
  }
  google.accounts.id.initialize({
    client_id: clientId, callback: handleGoogleCredential,
    auto_select: false, cancel_on_tap_outside: true,
  });
  // Pre-render button in gate modal so it's instant when opened
  renderGoogleButton(document.getElementById('gsi-button-container'));
}

function renderAuthUI() {
  const user        = state.googleUser;
  const signinBtn   = document.getElementById('nav-signin-btn');
  const profileWrap = document.getElementById('profile-wrapper');
  const tabApps     = document.getElementById('tab-apps');

  if (user) {
    signinBtn.classList.add('hidden');
    profileWrap.classList.remove('hidden');
    if (tabApps) tabApps.classList.remove('hidden');

    const setAvatar = (imgId, phId) => {
      const img = document.getElementById(imgId);
      const ph  = document.getElementById(phId);
      if (!img || !ph) return;
      if (user.picture) {
        img.src = user.picture; img.style.display = ''; ph.style.display = 'none';
      } else {
        ph.textContent = user.name[0]; ph.style.display = ''; img.style.display = 'none';
      }
    };
    setAvatar('profile-avatar-img', 'profile-avatar-placeholder');
    setAvatar('dd-avatar-img',      'dd-avatar-placeholder');
    document.getElementById('profile-name-text').textContent = user.name.split(' ')[0];
    document.getElementById('dd-name').textContent  = user.name;
    document.getElementById('dd-email').textContent = user.email;
    updateAppsIndicator();
  } else {
    signinBtn.classList.remove('hidden');
    profileWrap.classList.add('hidden');
    if (tabApps) tabApps.classList.add('hidden');
    if (document.getElementById('applications-page')?.classList.contains('active')) {
      showPage('jobs');
    }
  }
}

function signOut() {
  const clientId = (typeof CONFIG !== 'undefined') ? CONFIG.GOOGLE_CLIENT_ID : '';
  if (clientId && !clientId.includes('YOUR_GOOGLE_CLIENT_ID') && typeof google !== 'undefined') {
    google.accounts.id.revoke(state.googleUser?.email || '', () => {});
  }
  state.googleUser = null;
  sessionStorage.removeItem('oh_guser');
  renderAuthUI();
  closeProfileDropdown();
  loadStats(); // reset Applications counter to platform total
  showToast('Signed out', 'info', 2500);
}

function toggleProfileDropdown() {
  const dd  = document.getElementById('profile-dropdown');
  const btn = document.getElementById('profile-btn');
  dd.classList.contains('hidden')
    ? (dd.classList.remove('hidden'), btn.setAttribute('aria-expanded','true'))
    : closeProfileDropdown();
}
function closeProfileDropdown() {
  document.getElementById('profile-dropdown').classList.add('hidden');
  document.getElementById('profile-btn').setAttribute('aria-expanded','false');
}

/** Open the auth gate. mode='apply' shows skip; mode='signin' hides it */
function openAuthGate(job, mode='apply') {
  state.pendingApplyJob = job || null;
  const isApply = mode === 'apply';
  document.getElementById('auth-gate-icon').textContent   = isApply ? '🔐' : '👤';
  document.getElementById('auth-gate-title').textContent  = isApply ? 'Sign in to Apply' : 'Sign in to CareerNest';
  document.getElementById('auth-gate-sub').innerHTML      = isApply
    ? 'Sign in with Google to apply.<br/>Your name and email will be auto-filled.'
    : 'Sign in to track applications,<br/>save jobs, and apply faster.';
  const skipEl = document.getElementById('auth-gate-skip');
  if (skipEl) skipEl.style.display = isApply ? '' : 'none';
  // Re-render button fresh (clears stale iframe)
  renderGoogleButton(document.getElementById('gsi-button-container'));
  document.getElementById('auth-gate-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeAuthGate() {
  document.getElementById('auth-gate-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════
   UTILITY — DEBOUNCE
═══════════════════════════════════════════════════ */
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ═══════════════════════════════════════════════════
   RIPPLE
═══════════════════════════════════════════════════ */
function addRipple(e) {
  const btn  = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x    = e.clientX - rect.left  - size / 2;
  const y    = e.clientY - rect.top   - size / 2;
  const rip  = document.createElement('span');
  rip.className = 'ripple-wave';
  rip.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
  btn.appendChild(rip);
  rip.addEventListener('animationend', () => rip.remove());
}
function attachRipples() {
  document.querySelectorAll('.btn-primary,.btn-secondary,.apply-btn,.submit-btn,.nav-btn.primary,.btn-next,.mobile-apply-btn').forEach(b => {
    b.removeEventListener('click', addRipple);
    b.addEventListener('click', addRipple);
  });
}

/* ═══════════════════════════════════════════════════
   SCROLL PROGRESS + NAV GLASS
═══════════════════════════════════════════════════ */
const scrollBar = document.getElementById('scroll-progress');
const nav       = document.getElementById('nav');
window.addEventListener('scroll', () => {
  const pct = document.documentElement.scrollHeight - innerHeight;
  scrollBar.style.width = pct > 0 ? (scrollY / pct * 100) + '%' : '0%';
  nav.classList.toggle('scrolled', scrollY > 30);
}, { passive: true });

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
function showToast(msg, type='info', duration=4000) {
  const icons = {success:'✅',error:'❌',info:'✨'};
  const tc  = document.getElementById('toast-container');
  const el  = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role','alert');
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span><button class="toast-close" aria-label="Dismiss">×</button>`;
  el.querySelector('.toast-close').onclick = () => el.remove();
  tc.appendChild(el);
  setTimeout(() => { el.style.animation = 'fadeIn .3s ease reverse both'; }, duration - 300);
  setTimeout(() => el.remove(), duration);
}

/* ═══════════════════════════════════════════════════
   PAGE NAVIGATION
═══════════════════════════════════════════════════ */
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(page + '-page').classList.add('active');
  
  // FIX: Safely check for the tab, accounting for the 'tab-apps' ID mismatch
  const tab = document.getElementById('tab-' + page) || (page === 'applications' ? document.getElementById('tab-apps') : null);
  if (tab) tab.classList.add('active');

  document.getElementById('hero').style.display = page === 'jobs' ? '' : 'none';
  if (page === 'applications') renderApplicationsPage();
}
/* ═══════════════════════════════════════════════════
   ACCORDION
═══════════════════════════════════════════════════ */
document.querySelectorAll('.acc-trigger').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const body     = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', !expanded);
    body.classList.toggle('open', !expanded);
  });
});

/* ═══════════════════════════════════════════════════
   SALARY RANGE SLIDER
═══════════════════════════════════════════════════ */
const salarySlider = document.getElementById('filter-salary');
const salaryVal    = document.getElementById('salary-value');
salarySlider.addEventListener('input', () => {
  const v   = parseInt(salarySlider.value);
  const pct = (v / 2000000 * 100).toFixed(1);
  salarySlider.style.setProperty('--pct', pct + '%');
  salaryVal.textContent = (v / 1000).toFixed(0);
});
salarySlider.addEventListener('change', debounce(() => {
  state.filters.salary_min = salarySlider.value > 0 ? salarySlider.value : '';
  state.page = 1; state.hasMore = true;
  resetAndLoad();
}, 400));

/* ═══════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════ */
async function loadStats() {
  try {
    const data = await apiFetch('/stats');
    animateCount('stat-jobs',        data.overview.active_jobs);
    animateCount('stat-companies',   data.overview.total_companies);
    animateCount('stat-internships', data.jobs_by_type?.['Internship'] || 0);

    // APPLICATIONS stat: show user's own count if signed in, platform total otherwise
    if (state.googleUser) {
      try {
        const myApps = await apiFetch(`/students/${encodeURIComponent(state.googleUser.email)}/applications`);
        animateCount('stat-applications', myApps.total || 0);
        // Update label to clarify
        const lbl = document.getElementById('stat-apps-label');
        if (lbl) lbl.textContent = 'MY APPLICATIONS';
      } catch {
        animateCount('stat-applications', data.overview.total_applications);
      }
    } else {
      animateCount('stat-applications', data.overview.total_applications);
      const lbl = document.getElementById('stat-apps-label');
      if (lbl) lbl.textContent = 'APPLICATIONS';
    }
  } catch (e) { /* silent — backend may not be up yet */ }
}
function animateCount(id, target) {
  const el   = document.getElementById(id);
  if (!el) return;
  let cur    = 0;
  const step = Math.ceil(target / 45);
  const iv   = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur.toLocaleString('en-IN');
    if (cur >= target) clearInterval(iv);
  }, 28);
}

/* ═══════════════════════════════════════════════════
   API
═══════════════════════════════════════════════════ */
async function apiFetch(path, opts={}) {
  try {
    const res = await fetch(API + path, { headers: {'Content-Type':'application/json'}, ...opts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }
    return res.json();
  } catch (e) {
    if (e.message === 'Failed to fetch') throw new Error('Cannot reach backend. Ensure FastAPI is running on port 8000.');
    throw e;
  }
}

function buildQuery(page) {
  const f = state.filters;
  const p = new URLSearchParams();
  if (f.search)           p.set('search',           f.search);
  if (f.category)         p.set('category',         f.category);
  if (f.job_type)         p.set('job_type',          f.job_type);
  if (f.experience_level) p.set('experience_level',  f.experience_level);
  if (f.location)         p.set('location',          f.location);
  if (f.is_remote === true) p.set('is_remote',       'true');
  if (f.salary_min)       p.set('salary_min',        f.salary_min);
  p.set('sort_by',   state.sort);
  p.set('page',      page);
  p.set('page_size', PAGE_SIZE);
  return p.toString();
}

/* ═══════════════════════════════════════════════════
   LOAD JOBS — initial / filter change
═══════════════════════════════════════════════════ */
function resetAndLoad() {
  state.page    = 1;
  state.jobs    = [];
  state.hasMore = true;
  document.getElementById('jobs-grid').innerHTML = '';
  loadJobs(true);
  syncURL();
}

async function loadJobs(initial = false) {
  if (state.loading) return;
  state.loading = true;
  if (initial) showSkeletons();

  try {
    const data = await apiFetch(`/jobs?${buildQuery(state.page)}`);
    const newJobs = data.jobs || [];
    state.total      = data.pagination?.total      || 0;
    state.totalPages = data.pagination?.total_pages || 1;
    state.hasMore    = state.page < state.totalPages;
    state.jobs       = initial ? newJobs : [...state.jobs, ...newJobs];
    renderJobs(newJobs, initial);
    updateJobsCount();
    renderActiveTags();
  } catch (e) {
    showToast(e.message, 'error');
    if (initial) {
      document.getElementById('jobs-grid').innerHTML = '';
      document.getElementById('empty-state').classList.remove('hidden');
    }
  } finally {
    state.loading = false;
    document.getElementById('load-spinner').classList.remove('visible');
  }
}

/* ═══════════════════════════════════════════════════
   INFINITE SCROLL
═══════════════════════════════════════════════════ */
const sentinel    = document.getElementById('load-more-sentinel');
const loadSpinner = document.getElementById('load-spinner');
const scrollObs   = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !state.loading && state.hasMore) {
    loadSpinner.classList.add('visible');
    state.page++;
    loadJobs(false);
  }
}, { rootMargin: '200px' });
scrollObs.observe(sentinel);

/* ═══════════════════════════════════════════════════
   SKELETONS
═══════════════════════════════════════════════════ */
function showSkeletons() {
  const g = document.getElementById('jobs-grid');
  g.innerHTML = Array(5).fill(`
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton sk-1"></div><div class="skeleton sk-2"></div><div class="skeleton sk-3"></div>
      <div class="sk-tags"><div class="skeleton sk-tag"></div><div class="skeleton sk-tag"></div></div>
      <div class="sk-meta"><div class="skeleton sk-meta-i"></div><div class="skeleton sk-meta-i"></div></div>
    </div>`).join('');
  document.getElementById('empty-state').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════
   RENDER JOBS
═══════════════════════════════════════════════════ */
function renderJobs(newJobs, initial = false) {
  const g = document.getElementById('jobs-grid');
  if (initial) g.innerHTML = '';

  if (state.jobs.length === 0) {
    document.getElementById('empty-state').classList.remove('hidden');
    return;
  }
  document.getElementById('empty-state').classList.add('hidden');

  const frag = document.createDocumentFragment();
  newJobs.forEach(job => {
    const div = document.createElement('div');
    div.innerHTML = jobCardHTML(job);
    const card = div.firstElementChild;
    frag.appendChild(card);
  });
  g.appendChild(frag);

  // Attach events to new cards
  g.querySelectorAll('.job-card:not([data-bound])').forEach(card => {
    card.setAttribute('data-bound','1');
    card.addEventListener('click', e => {
      if (e.target.closest('.bookmark-btn,.card-apply-btn')) return;
      openJobDetail(card.dataset.jobId);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openJobDetail(card.dataset.jobId);
    });
    card.querySelector('.bookmark-btn')?.addEventListener('click', ev => {
      ev.stopPropagation();
      const b = ev.currentTarget;
      toggleBookmark(b.dataset.jobId, b.dataset.jobTitle, b.dataset.companyName);
    });
    card.querySelector('.card-apply-btn')?.addEventListener('click', ev => {
      ev.stopPropagation();
      const jobId = card.dataset.jobId;
      const job   = state.jobs.find(j => j.id == jobId);
      if (job) openApplyModal(job);
    });
  });

  // Scroll reveal
  g.querySelectorAll('.job-card:not(.reveal-done)').forEach((card, i) => {
    card.classList.add('reveal');
    card.style.transitionDelay = Math.min(i * 0.045, 0.4) + 's';
    revealObs.observe(card);
  });

  attachRipples();
}

/* ═══════════════════════════════════════════════════
   JOB CARD HTML
═══════════════════════════════════════════════════ */
function jobCardHTML(job) {
  const isBookmarked = state.bookmarks.some(b => b.id === job.id);
  const company      = job.company || {};
  const logo         = company.logo_url
    ? `<img src="${company.logo_url}" alt="${company.name} logo" loading="lazy"/>`
    : `<span>${(company.name || '?')[0]}</span>`;

  // Salary — prominent, Priority 2
  const salaryText = job.salary_min
    ? `₹${(job.salary_min/1000).toFixed(0)}k${job.salary_max ? ` – ₹${(job.salary_max/1000).toFixed(0)}k` : '+'}`
    : null;

  // Posted X days ago
  const posted = job.created_at ? (() => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(job.created_at)) / 86400000));
    return diff === 0 ? 'Today' : diff === 1 ? '1 day ago' : `${diff} days ago`;
  })() : null;

  // Deadline
  const deadline = job.application_deadline ? (() => {
    const d    = new Date(job.application_deadline);
    const diff = Math.ceil((d - Date.now()) / 86400000);
    const lbl  = d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    return diff <= 7
      ? `<span class="deadline-badge urgent" aria-label="Closes ${lbl}"><svg width="11" height="11" aria-hidden="true"><use href="#ico-clock"/></svg> ${lbl} — Closes soon!</span>`
      : `<span class="deadline-badge" aria-label="Deadline ${lbl}"><svg width="11" height="11" aria-hidden="true"><use href="#ico-calendar"/></svg> ${lbl}</span>`;
  })() : '';

  const viewedClass = state.recentViewed.includes(String(job.id)) ? ' viewed' : '';

  return `
  <article class="job-card${isBookmarked ? ' bookmarked' : ''}${viewedClass}" role="listitem"
    data-job-id="${job.id}" tabindex="0"
    aria-label="${job.title} at ${company.name || 'Unknown'}">
    <div class="card-top">
      <div class="card-company-row">
        <div class="company-logo" aria-hidden="true">${logo}</div>
        <div class="card-title-group">
          <!-- Priority 1: Title -->
          <div class="job-title">${job.title}</div>
          <!-- Priority 2: Salary -->
          <div class="salary-prominent${salaryText ? '' : ' undisclosed'}">
            ${salaryText
              ? `${salaryText}`
              : 'Salary not disclosed'}
          </div>
          <!-- Priority 3: Company -->
          <div class="company-name">${company.name || '—'}</div>
        </div>
      </div>
      <div class="card-actions">
        <button class="bookmark-btn${isBookmarked ? ' active' : ''}"
          data-job-id="${job.id}"
          data-job-title="${job.title}"
          data-company-name="${company.name || ''}"
          aria-label="${isBookmarked ? 'Remove bookmark' : 'Bookmark'} ${job.title}"
          aria-pressed="${isBookmarked}">
          <svg width="14" height="14" aria-hidden="true"><use href="#ico-${isBookmarked ? 'bookmark-fill' : 'bookmark'}"/></svg>
        </button>
        <button class="card-apply-btn" aria-label="Quick apply to ${job.title}">
          Apply Now
          <svg width="11" height="11" aria-hidden="true"><use href="#ico-arrow-right"/></svg>
        </button>
      </div>
    </div>

    <div class="card-tags">
      ${job.job_type  ? `<span class="tag tag-type">${job.job_type}</span>` : ''}
      ${job.is_remote ? `<span class="tag tag-remote"><svg width="10" height="10" aria-hidden="true"><use href="#ico-wifi"/></svg> Remote</span>` : ''}
      ${job.category  ? `<span class="tag tag-cat">${job.category}</span>` : ''}
      ${job.experience_level ? `<span class="tag tag-exp">${job.experience_level}</span>` : ''}
    </div>

    <div class="card-meta">
      ${job.location ? `<span class="meta-item"><svg width="12" height="12" aria-hidden="true"><use href="#ico-map"/></svg>${job.location}</span>` : ''}
      ${job.openings ? `<span class="meta-item"><svg width="12" height="12" aria-hidden="true"><use href="#ico-users"/></svg>${job.openings} opening${job.openings !== 1 ? 's' : ''}</span>` : ''}
    </div>

    <div class="card-footer">
      ${posted ? `<span class="posted-ago"><svg width="11" height="11" aria-hidden="true"><use href="#ico-clock"/></svg>${posted}</span>` : '<span></span>'}
      <div style="display:flex;align-items:center;gap:.65rem">
        ${job.openings ? `<span class="openings-badge">${job.openings} open</span>` : ''}
        ${deadline}
      </div>
    </div>
  </article>`;
}

/* ═══════════════════════════════════════════════════
   JOB DETAIL MODAL
═══════════════════════════════════════════════════ */
async function openJobDetail(jobId) {
  state.currentJobId = jobId;
  const cached = state.jobs.find(j => String(j.id) === String(jobId));

  // Track recently viewed
  trackRecentView(String(jobId), cached?.title, cached?.company?.name);

  const overlay = document.getElementById('detail-modal');
  const content = document.getElementById('detail-modal-content');

  // Show spinner while loading
  content.innerHTML = `
    <div style="padding:4rem;text-align:center">
      <div style="width:28px;height:28px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div>
    </div>`;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  attachRipples();

  try {
    let job = cached;
    if (!job) { job = await apiFetch(`/jobs/${jobId}`); }
    state.currentJob = job;
    content.innerHTML = buildDetailHTML(job);
    document.getElementById('detail-close').addEventListener('click', closeDetailModal);

    // Anchor nav
    content.querySelectorAll('.anchor-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = content.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    });

    // Floating apply
    content.querySelector('.apply-btn')?.addEventListener('click', () => {
      closeDetailModal();
      openApplyModal(job);
    });

    // Mobile bottom bar
    showMobileApplyBar(job);

    attachRipples();
  } catch (e) {
    showToast(e.message, 'error');
    closeDetailModal();
  }
}

function buildDetailHTML(job) {
  const company    = job.company || {};
  const logo       = company.logo_url
    ? `<img src="${company.logo_url}" alt="${company.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:10px"/>`
    : `<span>${(company.name || '?')[0]}</span>`;
  const salary     = job.salary_min
    ? `₹${(job.salary_min/1000).toFixed(0)}k${job.salary_max ? ` – ₹${(job.salary_max/1000).toFixed(0)}k` : '+'}`
    : 'Not disclosed';
  const deadline   = job.application_deadline
    ? new Date(job.application_deadline).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
    : 'Rolling';
  const posted     = job.created_at
    ? new Date(job.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
    : '—';

  return `
    <button class="modal-close" id="detail-close" aria-label="Close job details">
      <svg width="14" height="14" aria-hidden="true"><use href="#ico-x"/></svg>
    </button>

    <!-- Sticky header -->
    <div class="detail-header">
      <!-- Anchor nav -->
      <nav class="detail-anchor-nav" aria-label="Jump to section">
        <a class="anchor-link active" href="#sec-overview">Overview</a>
        <a class="anchor-link" href="#sec-desc">Description</a>
        <a class="anchor-link" href="#sec-reqs">Requirements</a>
        <a class="anchor-link" href="#sec-skills">Skills</a>
      </nav>

      <div class="detail-company-row">
        <div class="detail-logo">${logo}</div>
        <div>
          <div class="detail-company-name">${company.name || '—'}</div>
          ${company.website ? `<a class="detail-company-website" href="${company.website}" target="_blank" rel="noopener">
            <svg width="11" height="11" aria-hidden="true"><use href="#ico-link"/></svg>${company.website}
          </a>` : ''}
        </div>
      </div>

      <h2 class="detail-title serif" id="detail-modal-title">${job.title}</h2>

      <div class="detail-tags">
        ${job.job_type   ? `<span class="tag tag-type">${job.job_type}</span>` : ''}
        ${job.is_remote  ? `<span class="tag tag-remote"><svg width="10" height="10" aria-hidden="true"><use href="#ico-wifi"/></svg>Remote</span>` : ''}
        ${job.category   ? `<span class="tag tag-cat">${job.category}</span>` : ''}
        ${job.experience_level ? `<span class="tag tag-exp">${job.experience_level}</span>` : ''}
      </div>

      <div class="detail-meta-grid" id="sec-overview">
        <div class="detail-meta-item">
          <span class="detail-meta-label">Salary</span>
          <span class="detail-meta-value salary">${salary}</span>
        </div>
        ${job.location ? `<div class="detail-meta-item"><span class="detail-meta-label">Location</span><span class="detail-meta-value">${job.location}</span></div>` : ''}
        ${job.openings ? `<div class="detail-meta-item"><span class="detail-meta-label">Openings</span><span class="detail-meta-value">${job.openings}</span></div>` : ''}
        <div class="detail-meta-item"><span class="detail-meta-label">Deadline</span><span class="detail-meta-value">${deadline}</span></div>
        <div class="detail-meta-item"><span class="detail-meta-label">Posted</span><span class="detail-meta-value">${posted}</span></div>
        ${job.applications_count != null ? `<div class="detail-meta-item"><span class="detail-meta-label">Applicants</span><span class="detail-meta-value">${job.applications_count}</span></div>` : ''}
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="detail-scroll-body">
      <div class="detail-body">
        ${job.description ? `
        <div class="detail-section" id="sec-desc">
          <div class="detail-section-title"><svg width="12" height="12" aria-hidden="true"><use href="#ico-briefcase"/></svg> Description</div>
          <p class="detail-desc">${job.description}</p>
        </div>` : ''}

        ${job.requirements?.length ? `
        <div class="detail-section" id="sec-reqs">
          <div class="detail-section-title"><svg width="12" height="12" aria-hidden="true"><use href="#ico-check"/></svg> Requirements</div>
          <ul class="detail-list">${job.requirements.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>` : ''}

        ${job.responsibilities?.length ? `
        <div class="detail-section">
          <div class="detail-section-title"><svg width="12" height="12" aria-hidden="true"><use href="#ico-star"/></svg> Responsibilities</div>
          <ul class="detail-list">${job.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>` : ''}

        ${job.skills?.length ? `
        <div class="detail-section" id="sec-skills">
          <div class="detail-section-title"><svg width="12" height="12" aria-hidden="true"><use href="#ico-zap"/></svg> Skills</div>
          <div class="detail-skill-tags">${job.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>
        </div>` : ''}

        ${job.benefits?.length ? `
        <div class="detail-section">
          <div class="detail-section-title"><svg width="12" height="12" aria-hidden="true"><use href="#ico-shield"/></svg> Benefits</div>
          <ul class="detail-list">${job.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
        </div>` : ''}
      </div>
    </div>

    <!-- Sticky floating footer -->
    <div class="detail-footer">
      <div class="detail-footer-info">
        <strong>${job.applications_count || 0}</strong> applications • Deadline: <strong>${deadline}</strong>
      </div>
      <button class="apply-btn" aria-label="Apply for ${job.title}">
        <svg width="15" height="15" aria-hidden="true"><use href="#ico-send"/></svg>
        Apply Now
      </button>
    </div>`;
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
  document.body.style.overflow = '';
  hideMobileApplyBar();
}

/* ═══════════════════════════════════════════════════
   APPLY MODAL — 2-STEP (with Google Auth gate)
═══════════════════════════════════════════════════ */
function openApplyModal(job) {
  // If user is not signed in, show auth gate first
  if (!state.googleUser) {
    openAuthGate(job);
    return;
  }
  _doOpenApplyModal(job);
}

function _doOpenApplyModal(job) {
  state.currentJob  = job;
  state.applyStep   = 1;
  document.getElementById('apply-job-subtitle').textContent = `${job.title} @ ${job.company?.name || '—'}`;
  document.getElementById('apply-modal-title').textContent  = 'Apply for Position';

  // Reset steps
  goToStep(1);
  document.getElementById('apply-form').reset();
  document.querySelectorAll('.field-error').forEach(e => e.classList.add('hidden'));
  document.querySelectorAll('.form-input,.form-textarea').forEach(el => el.classList.remove('error'));

  // Auto-fill from Google profile
  if (state.googleUser) {
    const nameEl  = document.getElementById('f-name');
    const emailEl = document.getElementById('f-email');
    if (nameEl  && !nameEl.value)  nameEl.value  = state.googleUser.name;
    if (emailEl && !emailEl.value) emailEl.value = state.googleUser.email;
    // Make email read-only to prevent mismatch
    if (emailEl) { emailEl.readOnly = true; emailEl.style.opacity = '.8'; emailEl.title = 'Filled from your Google account'; }
  }

  // Restore success state if any
  const inner = document.getElementById('apply-modal-inner');
  if (!inner.querySelector('.step-indicator')) {
    location.reload();
    return;
  }

  document.getElementById('apply-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  attachRipples();
}

function goToStep(step) {
  state.applyStep = step;
  document.querySelectorAll('.apply-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`apply-step-${step}`).classList.add('active');

  // Update step indicator
  const d1 = document.getElementById('step-dot-1');
  const d2 = document.getElementById('step-dot-2');
  const l1 = document.getElementById('step-line-1');
  const lbl= document.getElementById('step-label');

  if (step === 1) {
    d1.className = 'step-dot active'; d1.innerHTML = '<span>1</span>';
    d2.className = 'step-dot';        d2.innerHTML = '<span>2</span>';
    l1.classList.remove('done');
    lbl.textContent = 'Step 1 of 2 — Your Details';
  } else {
    d1.className = 'step-dot done';   d1.innerHTML = '';
    d2.className = 'step-dot active'; d2.innerHTML = '<span>2</span>';
    l1.classList.add('done');
    lbl.textContent = 'Step 2 of 2 — Links & Cover Letter';
  }
}

function closeApplyModal() {
  document.getElementById('apply-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// Step navigation
document.getElementById('btn-next-1').addEventListener('click', () => {
  const name  = document.getElementById('f-name');
  const email = document.getElementById('f-email');
  let ok      = true;
  if (!name.value.trim()) {
    name.classList.add('error');
    document.getElementById('err-name').classList.remove('hidden'); ok = false;
  } else {
    name.classList.remove('error');
    document.getElementById('err-name').classList.add('hidden');
  }
  if (!email.value.trim() || !email.validity.valid) {
    email.classList.add('error');
    document.getElementById('err-email').classList.remove('hidden'); ok = false;
  } else {
    email.classList.remove('error');
    document.getElementById('err-email').classList.add('hidden');
  }
  if (ok) goToStep(2);
});

document.getElementById('btn-back-2').addEventListener('click', () => goToStep(1));

document.getElementById('apply-form').addEventListener('submit', async e => {
  e.preventDefault();
  const resume = document.getElementById('f-resume');
  if (!resume.value.trim()) {
    resume.classList.add('error');
    document.getElementById('err-resume').classList.remove('hidden');
    return;
  }
  resume.classList.remove('error');
  document.getElementById('err-resume').classList.add('hidden');

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Submitting…`;

  try {
    const payload = {
      job_id:           state.currentJob?.id,
      full_name:        document.getElementById('f-name').value,
      email:            document.getElementById('f-email').value,
      phone:            document.getElementById('f-phone').value,
      graduation_year:  document.getElementById('f-graduation').value || null,
      institution:      document.getElementById('f-institution').value,
      years_experience: document.getElementById('f-experience').value || null,
      resume_url:       resume.value,
      linkedin_url:     document.getElementById('f-linkedin').value,
      portfolio_url:    document.getElementById('f-portfolio').value,
      cover_letter:     document.getElementById('f-cover').value,
    };
    await apiFetch('/applications', { method:'POST', body: JSON.stringify(payload) });

    /*
    // Save application locally
    const app = {
      id:        Date.now(),
      jobId:     state.currentJob?.id,
      title:     state.currentJob?.title,
      company:   state.currentJob?.company?.name,
      logo:      state.currentJob?.company?.logo_url,
      date:      new Date().toISOString(),
      status:    'pending',
    };
    state.applications.push(app);
    localStorage.setItem('oh_applications', JSON.stringify(state.applications));
    */
    updateAppsIndicator();
    loadStats(); // update "My Applications" counter in hero stats

    // Show success
    document.getElementById('apply-modal-inner').innerHTML = `
      <div class="success-state">
        <div class="success-icon" aria-label="Success">🎉</div>
        <h2 class="success-title serif">Application Submitted!</h2>
        <p class="success-sub">Your application for <strong>${state.currentJob?.title}</strong> has been sent. Good luck! Track it under <em>My Apps</em>.</p>
        <button class="btn-primary" style="margin-top:1.5rem;margin:1.5rem auto 0;display:flex" onclick="closeApplyModal()">Done</button>
      </div>`;
    attachRipples();
    showToast(`Applied to ${state.currentJob?.title}! 🎉`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" aria-hidden="true"><use href="#ico-send"/></svg> Submit Application`;
  }
});

/* ═══════════════════════════════════════════════════
   MY APPLICATIONS PAGE (Live from Backend)
═══════════════════════════════════════════════════ */
const STATUS_CONFIG = {
  'pending':     { label: 'Under Review', cls: 'pending' },
  'reviewing':   { label: 'Being Reviewed', cls: 'reviewing' },
  'shortlisted': { label: 'Shortlisted', cls: 'interview' },
  'accepted':    { label: 'Offer Received', cls: 'offered' },
  'rejected':    { label: 'Not Selected', cls: 'rejected' },
};

async function renderApplicationsPage() {
  const grid  = document.getElementById('apps-grid');
  const empty = document.getElementById('apps-empty');

  if (!state.googleUser) {
    grid.innerHTML = '';
    empty.innerHTML = `<div class="empty-icon">🔐</div><p>Please sign in to view your applications.</p>`;
    empty.classList.remove('hidden');
    return;
  }

  // Show a loading message while we fetch
  grid.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--muted);">Fetching your applications...</div>';
  empty.classList.add('hidden');

  try {
    const res = await apiFetch(`/students/${encodeURIComponent(state.googleUser.email)}/applications`);
    const apps = res.applications || [];

    if (!apps.length) {
      grid.innerHTML  = '';
      empty.innerHTML = `<div class="empty-icon">📋</div><p>No applications yet. Start applying to see them here!</p>`;
      empty.classList.remove('hidden');
      return;
    }

    // Map backend data to HTML cards
    grid.innerHTML = apps.slice().reverse().map((app, i) => {
      // Ensure backend status strings map cleanly
      const statusKey = app.status ? app.status.toLowerCase() : 'pending';
      const sc  = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
      
      const letter = (app.company_name && app.company_name.length > 0) ? app.company_name[0].toUpperCase() : '?';
      const logo = `<span>${letter}</span>`;
      const date = new Date(app.applied_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      
      return `
      <div class="app-card reveal" style="animation-delay:${i * 0.06}s">
        <div class="app-logo">${logo}</div>
        <div class="app-info">
          <div class="app-title">${app.job_title}</div>
          <div class="app-company">${app.company_name || '—'}</div>
          <div class="app-date">
            <svg width="11" height="11" aria-hidden="true" style="margin-right:4px;"><use href="#ico-calendar"/></svg>
            Applied ${date}
          </div>
        </div>
        <span class="status-badge ${sc.cls}" aria-label="Status: ${sc.label}">
          <span class="status-dot" aria-hidden="true"></span>${sc.label}
        </span>
      </div>`;
    }).join('');

    grid.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  } catch (e) {
    grid.innerHTML = '';
    empty.innerHTML = `<div class="empty-icon">⚠️</div><p style="color:var(--red);">Failed to load applications. Ensure backend is running.</p>`;
    empty.classList.remove('hidden');
    console.error("Failed to load apps:", e);
  }
}

async function updateAppsIndicator() {
  const dot = document.getElementById('apps-dot');
  if (!state.googleUser) {
    dot.style.display = 'none';
    return;
  }
  try {
    const res = await apiFetch(`/students/${encodeURIComponent(state.googleUser.email)}/applications`);
    dot.style.display = (res.applications && res.applications.length > 0) ? '' : 'none';
  } catch(e) {
    dot.style.display = 'none';
  }
}
/* ═══════════════════════════════════════════════════
   BOOKMARKS
═══════════════════════════════════════════════════ */
function toggleBookmark(id, title, company) {
  const idx = state.bookmarks.findIndex(b => b.id == id);
  if (idx > -1) {
    state.bookmarks.splice(idx, 1);
    showToast('Bookmark removed', 'info', 2000);
  } else {
    state.bookmarks.push({ id, title, company });
    showToast(`Bookmarked: ${title}`, 'success', 2000);
  }
  localStorage.setItem('oh_bookmarks', JSON.stringify(state.bookmarks));
  updateBookmarkCount();

  // Update card UI
  document.querySelectorAll(`.bookmark-btn[data-job-id="${id}"]`).forEach(btn => {
    const active = state.bookmarks.some(b => b.id == id);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
    btn.querySelector('use').setAttribute('href', active ? '#ico-bookmark-fill' : '#ico-bookmark');
    btn.closest('.job-card')?.classList.toggle('bookmarked', active);
  });
}

function updateBookmarkCount() {
  document.getElementById('bookmark-count').textContent = state.bookmarks.length;
}

function openBookmarksModal() {
  const list = document.getElementById('bookmarks-list');
  if (!state.bookmarks.length) {
    list.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--muted)">No saved jobs yet. Bookmark some listings!</div>`;
  } else {
    list.innerHTML = state.bookmarks.map(b => `
      <div class="bookmark-item" role="button" tabindex="0"
        onclick="closeBookmarksModal();openJobDetail('${b.id}')"
        onkeydown="if(event.key==='Enter')this.click()"
        aria-label="View ${b.title}">
        <div class="bookmark-item-left">
          <div class="bookmark-item-title">${b.title}</div>
          <div class="bookmark-item-company">${b.company}</div>
        </div>
        <button class="bookmark-remove" aria-label="Remove bookmark"
          onclick="event.stopPropagation();toggleBookmark('${b.id}','${b.title}','${b.company}');openBookmarksModal()">
          <svg width="14" height="14" aria-hidden="true"><use href="#ico-trash"/></svg>
        </button>
      </div>`).join('');
  }
  document.getElementById('bookmarks-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeBookmarksModal() {
  document.getElementById('bookmarks-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════════════
   RECENTLY VIEWED
═══════════════════════════════════════════════════ */
function trackRecentView(id, title, company) {
  if (!title) return;
  const key = String(id);
  state.recentViewed = state.recentViewed.filter(r => r.id !== key);
  state.recentViewed.unshift({ id: key, title, company });
  state.recentViewed = state.recentViewed.slice(0, 5);
  localStorage.setItem('oh_recent', JSON.stringify(state.recentViewed));
  renderRecentlyViewed();
}
function renderRecentlyViewed() {
  const sec   = document.getElementById('recently-viewed-section');
  const chips = document.getElementById('rv-chips');
  const items = state.recentViewed;
  if (!items.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  chips.innerHTML = items.map(r => `
    <button class="rv-chip" onclick="openJobDetail('${r.id}')" aria-label="Revisit ${r.title}">
      ${r.title}
      <span class="rv-chip-close" aria-hidden="true">×</span>
    </button>`).join('');
}

/* ═══════════════════════════════════════════════════
   MOBILE APPLY BAR
═══════════════════════════════════════════════════ */
function showMobileApplyBar(job) {
  const bar = document.getElementById('mobile-apply-bar');
  document.getElementById('mob-apply-title').textContent   = job.title;
  document.getElementById('mob-apply-company').textContent = job.company?.name || '';
  document.getElementById('mob-apply-btn').onclick = () => { closeDetailModal(); openApplyModal(job); };
  bar.classList.add('visible');
}
function hideMobileApplyBar() {
  document.getElementById('mobile-apply-bar').classList.remove('visible');
}

/* ═══════════════════════════════════════════════════
   FILTER UI
═══════════════════════════════════════════════════ */
function updateJobsCount() {
  document.getElementById('jobs-count').innerHTML =
    `<strong>${state.total.toLocaleString('en-IN')}</strong> listing${state.total !== 1 ? 's' : ''} found`;
}

function renderActiveTags() {
  const f   = state.filters;
  const container = document.getElementById('active-filters');
  const tags = [];
  if (f.search)           tags.push({ label: `"${f.search}"`, key: 'search' });
  if (f.category)         tags.push({ label: f.category, key: 'category' });
  if (f.job_type)         tags.push({ label: f.job_type, key: 'job_type' });
  if (f.experience_level) tags.push({ label: f.experience_level, key: 'experience_level' });
  if (f.location)         tags.push({ label: `📍 ${f.location}`, key: 'location' });
  if (f.is_remote)        tags.push({ label: 'Remote Only', key: 'is_remote' });
  if (f.salary_min)       tags.push({ label: `Min ₹${(parseInt(f.salary_min)/1000).toFixed(0)}k`, key: 'salary_min' });

  container.innerHTML = tags.map(t => `
    <span class="filter-tag" role="listitem">
      ${t.label}
      <button onclick="clearTag('${t.key}')" aria-label="Remove ${t.label} filter">×</button>
    </span>`).join('');

  // Active count badge
  const count = tags.length;
  const badge = document.getElementById('active-filter-badge');
  const mobBadge = document.getElementById('mobile-filter-count');
  if (count > 0) {
    badge.textContent = count; badge.style.display = '';
    mobBadge.textContent = count; mobBadge.style.display = '';
    badge.classList.add('bump'); setTimeout(() => badge.classList.remove('bump'), 400);
  } else {
    badge.style.display = 'none';
    mobBadge.style.display = 'none';
  }
}

function clearTag(key) {
  state.filters[key] = key === 'is_remote' ? null : '';
  if (key === 'search')   { document.getElementById('nav-search-input').value = ''; }
  if (key === 'category') { document.getElementById('filter-category').value = ''; }
  if (key === 'job_type') { document.getElementById('filter-type').value = ''; }
  if (key === 'experience_level') { document.getElementById('filter-exp').value = ''; }
  if (key === 'location') { document.getElementById('filter-location').value = ''; }
  if (key === 'is_remote'){ document.getElementById('filter-remote').checked = false; }
  if (key === 'salary_min') {
    const s = document.getElementById('filter-salary');
    s.value = 0; s.style.setProperty('--pct','0%');
    document.getElementById('salary-value').textContent = '0';
  }
  state.page = 1; state.hasMore = true;
  resetAndLoad();
}

/* ═══════════════════════════════════════════════════
   URL SYNC
═══════════════════════════════════════════════════ */
function syncURL() {
  const f      = state.filters;
  const params = new URLSearchParams();
  if (f.search)           params.set('q',        f.search);
  if (f.category)         params.set('cat',      f.category);
  if (f.job_type)         params.set('type',     f.job_type);
  if (f.experience_level) params.set('exp',      f.experience_level);
  if (f.location)         params.set('loc',      f.location);
  if (f.is_remote)        params.set('remote',   '1');
  if (f.salary_min)       params.set('sal',      f.salary_min);
  if (state.sort !== 'newest') params.set('sort', state.sort);
  const str = params.toString();
  window.history.replaceState({}, '', str ? `?${str}` : location.pathname);
}

function loadFromURL() {
  const p = new URLSearchParams(location.search);
  const set = (key, val) => { if (val) state.filters[key] = val; };
  set('search',           p.get('q'));
  set('category',         p.get('cat'));
  set('job_type',         p.get('type'));
  set('experience_level', p.get('exp'));
  set('location',         p.get('loc'));
  if (p.get('remote') === '1') state.filters.is_remote = true;
  if (p.get('sal')) state.filters.salary_min = p.get('sal');
  if (p.get('sort')) state.sort = p.get('sort');

  // Sync controls
  if (state.filters.search) document.getElementById('nav-search-input').value = state.filters.search;
  if (state.filters.category) document.getElementById('filter-category').value = state.filters.category;
  if (state.filters.job_type) document.getElementById('filter-type').value = state.filters.job_type;
  if (state.filters.experience_level) document.getElementById('filter-exp').value = state.filters.experience_level;
  if (state.filters.location) document.getElementById('filter-location').value = state.filters.location;
  if (state.filters.is_remote) document.getElementById('filter-remote').checked = true;
  if (state.filters.salary_min) {
    const s = document.getElementById('filter-salary');
    s.value = state.filters.salary_min;
    const pct = (parseInt(s.value) / 2000000 * 100).toFixed(1);
    s.style.setProperty('--pct', pct + '%');
    document.getElementById('salary-value').textContent = (parseInt(s.value)/1000).toFixed(0);
  }
  if (state.sort) document.getElementById('sort-select').value = state.sort;
}

/* ═══════════════════════════════════════════════════
   SCROLL REVEAL OBSERVER
═══════════════════════════════════════════════════ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      entry.target.classList.add('reveal-done');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

// Observe static elements
document.querySelectorAll('.filter-group,.sidebar-header-bar,.hero-ctas,.trust-badges,.hero-stats').forEach(el => {
  el.classList.add('reveal');
  revealObs.observe(el);
});

/* ═══════════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════════ */
const debouncedSearch = debounce(val => {
  state.filters.search = val;
  state.page = 1; state.hasMore = true;
  resetAndLoad();
}, 360);
document.getElementById('nav-search-input').addEventListener('input', e => debouncedSearch(e.target.value.trim()));

['filter-category','filter-type','filter-exp'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', e => {
    const map = {'filter-category':'category','filter-type':'job_type','filter-exp':'experience_level'};
    state.filters[map[id]] = e.target.value;
    state.page = 1; state.hasMore = true; resetAndLoad();
  });
});

const debouncedLocation = debounce(val => {
  state.filters.location = val;
  state.page = 1; state.hasMore = true; resetAndLoad();
}, 480);
document.getElementById('filter-location')?.addEventListener('input', e => debouncedLocation(e.target.value.trim()));

document.getElementById('filter-remote').addEventListener('change', e => {
  state.filters.is_remote = e.target.checked ? true : null;
  state.page = 1; state.hasMore = true; resetAndLoad();
});

document.getElementById('sort-select').addEventListener('change', e => {
  state.sort = e.target.value;
  state.page = 1; state.hasMore = true; resetAndLoad();
});

document.getElementById('clear-filters-btn').addEventListener('click', () => {
  state.filters = { search:'', category:'', job_type:'', experience_level:'', location:'', is_remote:null, salary_min:'' };
  document.getElementById('nav-search-input').value = '';
  document.getElementById('filter-category').value  = '';
  document.getElementById('filter-type').value      = '';
  document.getElementById('filter-exp').value       = '';
  document.getElementById('filter-location').value  = '';
  document.getElementById('filter-remote').checked  = false;
  const s = document.getElementById('filter-salary');
  s.value = 0; s.style.setProperty('--pct','0%');
  document.getElementById('salary-value').textContent = '0';
  state.page = 1; state.hasMore = true; resetAndLoad();
});

// Mobile sidebar
const sidebar  = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
function openSidebar() {
  sidebar.classList.add('open');
  backdrop.classList.add('visible');
  document.getElementById('mobile-filter-btn').setAttribute('aria-expanded','true');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
  document.getElementById('mobile-filter-btn').setAttribute('aria-expanded','false');
}
document.getElementById('mobile-filter-btn').addEventListener('click', openSidebar);
document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
backdrop.addEventListener('click', closeSidebar);

// Modal close
document.getElementById('bookmarks-btn').addEventListener('click', openBookmarksModal);
document.getElementById('bookmarks-close').addEventListener('click', closeBookmarksModal);
document.getElementById('apply-close').addEventListener('click', closeApplyModal);

document.getElementById('detail-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDetailModal(); });
document.getElementById('apply-modal').addEventListener('click',  e => { if (e.target === e.currentTarget) closeApplyModal(); });
document.getElementById('bookmarks-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeBookmarksModal(); });

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('detail-modal').classList.contains('hidden'))   closeDetailModal();
  if (!document.getElementById('apply-modal').classList.contains('hidden'))    closeApplyModal();
  if (!document.getElementById('bookmarks-modal').classList.contains('hidden')) closeBookmarksModal();
  if (sidebar.classList.contains('open')) closeSidebar();
});

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
loadFromURL();
updateBookmarkCount();
updateAppsIndicator();
renderRecentlyViewed();
loadStats();
resetAndLoad();
attachRipples();

// ── Google Auth wiring ────────────────────────────
renderAuthUI(); // restore session if any

// Nav Sign-In button → open auth gate in 'signin' mode
// (uses renderButton() inside the gate — NO One Tap / prompt())
document.getElementById('nav-signin-btn').addEventListener('click', () => {
  const clientId = (typeof CONFIG !== 'undefined') ? CONFIG.GOOGLE_CLIENT_ID : '';
  if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
    showToast('Google Sign-In not configured. Set GOOGLE_CLIENT_ID in config.js', 'error', 5000);
    return;
  }
  openAuthGate(null, 'signin');
});

document.getElementById('profile-btn').addEventListener('click', toggleProfileDropdown);
document.getElementById('signout-btn').addEventListener('click', signOut);

// Auth gate events
document.getElementById('auth-gate-close').addEventListener('click', closeAuthGate);
document.getElementById('auth-gate-skip').addEventListener('click', () => {
  closeAuthGate();
  if (state.pendingApplyJob) {
    const job = state.pendingApplyJob;
    state.pendingApplyJob = null;
    _doOpenApplyModal(job);
  }
});
document.getElementById('auth-gate-skip').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') document.getElementById('auth-gate-skip').click();
});

// Close profile dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#profile-wrapper')) closeProfileDropdown();
});

// Close auth gate on overlay click
document.getElementById('auth-gate-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAuthGate();
});

// ── Google GIS init ────────────────────────────────
// We poll for the GSI script to load (it's loaded async/defer).
// Once loaded, initGoogleAuth() initialises GIS and pre-renders
// the sign-in button into #gsi-button-container inside the gate modal.
window.addEventListener('load', () => {
  const tryInit = () => {
    if (typeof google !== 'undefined' && google.accounts?.id) {
      initGoogleAuth();
    } else {
      setTimeout(tryInit, 150);
    }
  };
  tryInit();
});
