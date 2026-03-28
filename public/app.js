// ================================================
// CEO Dashboard — Freedcamp Milestones App Logic
// ================================================

const API_BASE = '/api';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

let allMilestones = [];
let allProjects = [];
let activeProjectFilter = 'all';
let activeStatusFilter = 'all';
let activeAssigneeFilter = 'all';
let searchQuery = '';

// DOM Elements
const milestonesGrid = document.getElementById('milestonesGrid');
const projectFilters = document.getElementById('projectFilters');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const assigneeFilter = document.getElementById('assigneeFilter');
const btnRefresh = document.getElementById('btnRefresh');
const btnRetry = document.getElementById('btnRetry');
const lastUpdated = document.getElementById('lastUpdated');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');

// Stat elements
const statTotal = document.getElementById('statTotal');
const statCompleted = document.getElementById('statCompleted');
const statOverdue = document.getElementById('statOverdue');
const statActive = document.getElementById('statActive');

// ========================================
// Data Fetching
// ========================================

async function fetchData() {
  showLoading();
  hideError();

  btnRefresh.classList.add('spinning');

  try {
    const response = await fetch(`${API_BASE}/milestones/all`);
    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    allProjects = data.projects || [];
    allMilestones = data.milestones || [];

    renderProjectFilters();
    renderAssigneeFilters();
    renderMilestones();
    updateStats();
    updateLastUpdated();
  } catch (err) {
    console.error('Failed to fetch data:', err);
    showError(err.message);
  } finally {
    btnRefresh.classList.remove('spinning');
  }
}

// ========================================
// Rendering
// ========================================

function renderProjectFilters() {
  projectFilters.innerHTML = `<button class="filter-tab ${activeProjectFilter === 'all' ? 'active' : ''}" data-filter="all">All Projects</button>`;

  allProjects.forEach(project => {
    const tab = document.createElement('button');
    tab.className = `filter-tab ${activeProjectFilter === project.id ? 'active' : ''}`;
    tab.dataset.filter = project.id;
    tab.textContent = project.name || `Project ${project.id}`;
    projectFilters.appendChild(tab);
  });

  // Attach listeners
  projectFilters.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeProjectFilter = tab.dataset.filter;
      projectFilters.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderMilestones();
      updateStats();
    });
  });
}

function renderAssigneeFilters() {
  // Extract unique assignees
  const assignees = new Set();
  allMilestones.forEach(ms => {
    const name = getAssigneeName(ms);
    if (name && name !== 'Unassigned') {
      assignees.add(name);
    }
  });
  
  // Sort alphabetically
  const sortedAssignees = Array.from(assignees).sort((a, b) => a.localeCompare(b));
  
  // Save current selection if possible
  const currentSelection = assigneeFilter.value;
  
  assigneeFilter.innerHTML = '<option value="all">All Team Members</option>';
  sortedAssignees.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    assigneeFilter.appendChild(option);
  });
  
  // Restore selection if it still exists
  if (sortedAssignees.includes(currentSelection)) {
    assigneeFilter.value = currentSelection;
    activeAssigneeFilter = currentSelection;
  } else {
    assigneeFilter.value = 'all';
    activeAssigneeFilter = 'all';
  }
}

function getFilteredMilestones() {
  return allMilestones.filter(ms => {
    // Project filter
    if (activeProjectFilter !== 'all') {
      const pid = String(ms.project_id || '');
      if (pid !== String(activeProjectFilter)) return false;
    }

    // Status filter
    const status = getMilestoneStatus(ms);
    if (activeStatusFilter !== 'all') {
      if (activeStatusFilter === 'completed' && !status.isCompleted) return false;
      if (activeStatusFilter === 'overdue' && !status.isOverdue) return false;
      if (activeStatusFilter === 'active' && (status.isCompleted || status.isOverdue)) return false;
    }
    
    // Assignee filter
    const assignee = getAssigneeName(ms);
    if (activeAssigneeFilter !== 'all') {
      if (assignee !== activeAssigneeFilter) return false;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (ms.title || ms.name || '').toLowerCase();
      const desc = (ms.description || '').toLowerCase();
      const project = (ms.project_name || '').toLowerCase();
      const assigneeLower = assignee.toLowerCase();
      if (!title.includes(q) && !desc.includes(q) && !project.includes(q) && !assigneeLower.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

function renderMilestones() {
  const filtered = getFilteredMilestones();

  if (filtered.length === 0 && allMilestones.length > 0) {
    milestonesGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  milestonesGrid.innerHTML = filtered.map((ms, i) => createMilestoneCard(ms, i)).join('');
  
  // Attach click listeners to navigate to milestone detail page
  document.querySelectorAll('.milestone-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const projectId = card.dataset.projectId;
      const milestoneId = card.dataset.milestoneId;
      window.location.href = `/milestone.html?project_id=${projectId}&milestone_id=${milestoneId}`;
    });
  });
}

function createMilestoneCard(ms, index) {
  const status = getMilestoneStatus(ms);
  const progress = getProgress(ms);
  const dueDate = formatDueDate(ms);
  const assignee = getAssigneeName(ms);
  const assigneeInitials = getInitials(assignee);
  const avatarColor = getAvatarColor(assignee);
  const description = ms.description || 'No description provided';

  let statusClass, badgeClass, badgeText, fillClass;
  if (status.isCompleted) {
    statusClass = 'status-completed';
    badgeClass = 'badge-completed';
    badgeText = 'Completed';
    fillClass = 'fill-complete';
  } else if (status.isOverdue) {
    statusClass = 'status-overdue';
    badgeClass = 'badge-overdue';
    badgeText = 'Overdue';
    fillClass = 'fill-danger';
  } else if (status.isAtRisk) {
    statusClass = 'status-at-risk';
    badgeClass = 'badge-at-risk';
    badgeText = 'At Risk';
    fillClass = 'fill-warning';
  } else {
    statusClass = 'status-on-track';
    badgeClass = 'badge-on-track';
    badgeText = 'On Track';
    fillClass = 'fill-success';
  }

  const dueDateClass = status.isOverdue ? 'overdue' : (status.isAtRisk ? 'soon' : '');

  return `
    <div class="milestone-card ${statusClass}" style="animation-delay: ${index * 0.06}s" data-project-id="${ms.project_id}" data-milestone-id="${ms.id}">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(ms.title || ms.name || 'Untitled Milestone')}</h3>
        <span class="card-badge ${badgeClass}">${badgeText}</span>
      </div>

      <p class="card-description">${escapeHtml(description)}</p>

      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Progress</span>
          <span class="progress-value">${progress}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="card-meta">
        <div class="meta-item">
          <span class="meta-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <span class="meta-text ${dueDateClass}">${dueDate}</span>
        </div>
        <div class="assignee">
          <div class="assignee-avatar" style="background: ${avatarColor}">${assigneeInitials}</div>
          <span class="assignee-name">${escapeHtml(assignee)}</span>
        </div>
      </div>
      
      <div class="tasks-container" data-loaded="false"></div>
    </div>
  `;
}

// ========================================
// Progress Dashboard Builder
// ========================================

function buildProgressDashboard(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 1 || t.status === '1' || t.status_title === 'Completed' || t.progress === 100).length;
  const inProgress = tasks.filter(t => {
    const isCompleted = t.status === 1 || t.status === '1' || t.status_title === 'Completed' || t.progress === 100;
    return !isCompleted && t.progress > 0;
  }).length;
  const yetToStart = total - completed - inProgress;

  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
  const yetToStartPct = total > 0 ? Math.round((yetToStart / total) * 100) : 0;

  // Build assignee breakdown
  const assigneeMap = {};
  tasks.forEach(t => {
    const name = t.assigned_to_fullname || 'Unassigned';
    if (!assigneeMap[name]) assigneeMap[name] = { total: 0, completed: 0 };
    assigneeMap[name].total++;
    if (t.status === 1 || t.status === '1' || t.status_title === 'Completed' || t.progress === 100) {
      assigneeMap[name].completed++;
    }
  });
  const assignees = Object.entries(assigneeMap).sort((a, b) => b[1].total - a[1].total);

  // Sort tasks: in-progress first, then yet-to-start, then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    const aCompleted = a.status === 1 || a.status === '1' || a.status_title === 'Completed' || a.progress === 100;
    const bCompleted = b.status === 1 || b.status === '1' || b.status_title === 'Completed' || b.progress === 100;
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
    return (b.progress || 0) - (a.progress || 0);
  });

  const donutChart = buildDonutChart(completed, inProgress, yetToStart, total);

  return `
    <div class="progress-dashboard">
      <div class="pd-top">
        <div class="pd-chart-section">
          ${donutChart}
        </div>
        <div class="pd-stats-section">
          <div class="pd-stat-box pd-stat-completed">
            <div class="pd-stat-indicator"></div>
            <div class="pd-stat-content">
              <span class="pd-stat-count">${completed}</span>
              <span class="pd-stat-label">Completed</span>
            </div>
            <span class="pd-stat-pct">${completedPct}%</span>
          </div>
          <div class="pd-stat-box pd-stat-inprogress">
            <div class="pd-stat-indicator"></div>
            <div class="pd-stat-content">
              <span class="pd-stat-count">${inProgress}</span>
              <span class="pd-stat-label">In Progress</span>
            </div>
            <span class="pd-stat-pct">${inProgressPct}%</span>
          </div>
          <div class="pd-stat-box pd-stat-notstarted">
            <div class="pd-stat-indicator"></div>
            <div class="pd-stat-content">
              <span class="pd-stat-count">${yetToStart}</span>
              <span class="pd-stat-label">Yet to Start</span>
            </div>
            <span class="pd-stat-pct">${yetToStartPct}%</span>
          </div>
        </div>
      </div>

      ${assignees.length > 0 ? `
        <div class="pd-assignees">
          <div class="pd-section-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Team Breakdown
          </div>
          ${assignees.map(([name, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            const initials = getInitials(name);
            const color = getAvatarColor(name);
            return `
              <div class="pd-assignee-row">
                <div class="pd-assignee-info">
                  <div class="assignee-avatar" style="background: ${color}; width: 24px; height: 24px; font-size: 0.6rem;">${initials}</div>
                  <span class="pd-assignee-name">${escapeHtml(name)}</span>
                </div>
                <div class="pd-assignee-progress">
                  <div class="pd-mini-track">
                    <div class="pd-mini-fill" style="width: ${pct}%"></div>
                  </div>
                  <span class="pd-assignee-count">${data.completed}/${data.total}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div class="pd-task-list">
        <div class="pd-section-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          All Tasks
        </div>
        ${sortedTasks.map(task => {
          const isCompleted = task.status === 1 || task.status === '1' || task.status_title === 'Completed' || task.progress === 100;
          const isInProgress = !isCompleted && (task.progress || 0) > 0;
          const progress = task.progress || 0;
          const statusLabel = isCompleted ? 'Completed' : (isInProgress ? 'In Progress' : 'Yet to Start');
          const statusClass = isCompleted ? 'task-done' : (isInProgress ? 'task-wip' : 'task-todo');
          const assignee = task.assigned_to_fullname || '';

          return `
            <div class="pd-task-row ${statusClass}">
              <div class="pd-task-check">
                ${isCompleted
                  ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
                  : isInProgress
                    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
                }
              </div>
              <div class="pd-task-info">
                <div class="pd-task-title">${escapeHtml(task.title || 'Untitled')}</div>
                <div class="pd-task-subtitle">
                  <span class="pd-task-status-label ${statusClass}">${statusLabel}</span>
                  ${assignee ? `<span class="pd-task-assignee">• ${escapeHtml(assignee)}</span>` : ''}
                </div>
              </div>
              <div class="pd-task-progress-mini">
                <div class="pd-task-bar">
                  <div class="pd-task-bar-fill ${statusClass}" style="width: ${progress}%"></div>
                </div>
                <span class="pd-task-pct">${progress}%</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function buildDonutChart(completed, inProgress, yetToStart, total) {
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return `
      <div class="pd-donut-wrapper">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="rgba(148,163,184,0.1)" stroke-width="${strokeWidth}"/>
        </svg>
        <div class="pd-donut-center">
          <span class="pd-donut-value">0</span>
          <span class="pd-donut-label">tasks</span>
        </div>
      </div>
    `;
  }

  const segments = [
    { value: completed, color: '#10b981' },   // emerald
    { value: inProgress, color: '#f59e0b' },   // amber
    { value: yetToStart, color: '#334155' },   // slate
  ];

  let offset = 0;
  const circles = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const currentOffset = offset;
    offset += dash;
    if (seg.value === 0) return '';
    return `<circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none"
              stroke="${seg.color}" stroke-width="${strokeWidth}"
              stroke-dasharray="${dash} ${gap}"
              stroke-dashoffset="${-currentOffset}"
              stroke-linecap="round"
              style="transition: stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease;"
              transform="rotate(-90 ${size/2} ${size/2})"/>`;
  }).join('');

  const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return `
    <div class="pd-donut-wrapper">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="rgba(148,163,184,0.06)" stroke-width="${strokeWidth}"/>
        ${circles}
      </svg>
      <div class="pd-donut-center">
        <span class="pd-donut-value">${overallPct}%</span>
        <span class="pd-donut-label">done</span>
      </div>
    </div>
  `;
}

// ========================================
// Status & Progress Helpers
// ========================================

function getMilestoneStatus(ms) {
  const now = new Date();
  
  // In Freedcamp API, status = 2 usually means completed, 0 means in progress
  const isCompleted = ms.completed === 1 || ms.completed === '1' ||
                      ms.status === 'completed' || ms.status === 2 || ms.status === '2' || 
                      ms.is_completed === 1 || ms.is_completed === '1' || ms.progress === 100;

  let dueDate = null;
  if (ms.due_ts) {
    dueDate = new Date(ms.due_ts * 1000);
  } else if (ms.due_date || ms.end_date || ms.date) {
    const raw = ms.due_date || ms.end_date || ms.date;
    dueDate = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw);
  }

  // To be overdue, it must not be completed AND have a due date in the past
  // Let's ensure midnight logic for due date (end of day)
  if (dueDate) {
    dueDate.setHours(23, 59, 59, 999);
  }
  const isOverdue = !isCompleted && dueDate && dueDate < now;

  // At risk = due within 7 days
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const isAtRisk = !isCompleted && !isOverdue && dueDate && (dueDate - now) < sevenDays && (dueDate - now) > 0;

  return { isCompleted, isOverdue, isAtRisk, dueDate };
}

function getProgress(ms) {
  if (ms.progress !== undefined && ms.progress !== null) {
    return Math.min(100, Math.max(0, Number(ms.progress)));
  }
  
  const status = getMilestoneStatus(ms);
  if (status.isCompleted) return 100;
  
  if (ms.tasks_complete !== undefined && ms.tasks_total !== undefined && ms.tasks_total > 0) {
    return Math.round((ms.tasks_complete / ms.tasks_total) * 100);
  }
  return 0;
}

function getAssigneeName(ms) {
  if (ms.assigned_to_fullname) return ms.assigned_to_fullname;
  if (ms.assigned_to_name) return ms.assigned_to_name;
  if (ms.assignee_name) return ms.assignee_name;
  if (ms.user_name) return ms.user_name;
  if (ms.assigned_to) return typeof ms.assigned_to === 'object' ? (ms.assigned_to.name || 'Unknown') : `User ${ms.assigned_to}`;
  if (ms.assignee) return typeof ms.assignee === 'object' ? (ms.assignee.name || 'Unknown') : `User ${ms.assignee}`;
  if (ms.creator_name) return `Created by ${ms.creator_name}`;
  return 'Unassigned';
}

function formatDueDate(ms) {
  const status = getMilestoneStatus(ms);
  if (!status.dueDate || isNaN(status.dueDate.getTime())) return 'No due date';

  const now = new Date();
  const diff = status.dueDate - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  const formatted = status.dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: status.dueDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  if (status.isCompleted) return formatted;
  if (days < 0) return `${formatted} (${Math.abs(days)}d overdue)`;
  if (days === 0) return `${formatted} (Today)`;
  if (days === 1) return `${formatted} (Tomorrow)`;
  if (days <= 7) return `${formatted} (${days}d left)`;
  return formatted;
}

function getInitials(name) {
  if (!name || name === 'Unassigned') return '?';
  return name.split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  const colors = [
    'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #10b981, #06b6d4)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #14b8a6, #10b981)',
  ];
  if (!name || name === 'Unassigned') return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ========================================
// Stats
// ========================================

function updateStats() {
  const filtered = getFilteredMilestones();
  const completed = filtered.filter(ms => getMilestoneStatus(ms).isCompleted).length;
  const overdue = filtered.filter(ms => getMilestoneStatus(ms).isOverdue).length;
  const active = filtered.length - completed - overdue;

  animateValue(statTotal, filtered.length);
  animateValue(statCompleted, completed);
  animateValue(statOverdue, overdue);
  animateValue(statActive, active);
}

function animateValue(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) {
    el.textContent = target;
    return;
  }

  const duration = 500;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(current + (target - current) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// ========================================
// UI Helpers
// ========================================

function showLoading() {
  milestonesGrid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
  emptyState.classList.add('hidden');
  errorState.classList.add('hidden');
}

function showError(msg) {
  milestonesGrid.innerHTML = '';
  emptyState.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorMessage.textContent = msg || 'Something went wrong while connecting to Freedcamp.';
}

function hideError() {
  errorState.classList.add('hidden');
}

function updateLastUpdated() {
  const now = new Date();
  lastUpdated.textContent = `Updated ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========================================
// Event Listeners
// ========================================

btnRefresh.addEventListener('click', fetchData);
btnRetry.addEventListener('click', fetchData);

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderMilestones();
  updateStats();
});

statusFilter.addEventListener('change', (e) => {
  activeStatusFilter = e.target.value;
  renderMilestones();
  updateStats();
});

assigneeFilter.addEventListener('change', (e) => {
  activeAssigneeFilter = e.target.value;
  renderMilestones();
  updateStats();
});

// Stat card click to filter
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', (e) => {
    const status = card.dataset.status;
    if (status) {
      activeStatusFilter = status;
      statusFilter.value = status;
      renderMilestones();
      updateStats();
      
      // Update active styling on cards
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    }
  });
});

// Listen to dropdown to sync card active state too
statusFilter.addEventListener('change', (e) => {
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  const matchingCard = document.querySelector(`.stat-card[data-status="${e.target.value}"]`);
  if (matchingCard) matchingCard.classList.add('active');
});

// Auto-refresh
setInterval(fetchData, REFRESH_INTERVAL);

// ========================================
// Initialize
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // Set initial active card
  const initialCard = document.querySelector(`.stat-card[data-status="${activeStatusFilter}"]`);
  if (initialCard) initialCard.classList.add('active');
  
  fetchData();
});
