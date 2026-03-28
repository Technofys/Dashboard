// ================================================
// Milestone Detail Page — Logic
// ================================================

const API_BASE = '/api';

// Parse URL params
const params = new URLSearchParams(window.location.search);
const projectId = params.get('project_id');
const milestoneId = params.get('milestone_id');

// DOM refs
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const mainContent = document.getElementById('mainContent');
const milestoneTitle = document.getElementById('milestoneTitle');
const milestoneBadge = document.getElementById('milestoneBadge');
const milestoneSubtitle = document.getElementById('milestoneSubtitle');
const metricsGrid = document.getElementById('metricsGrid');
const chartInner = document.getElementById('chartInner');
const insightsList = document.getElementById('insightsList');
const teamGrid = document.getElementById('teamGrid');
const descriptionSection = document.getElementById('descriptionSection');
const descriptionContent = document.getElementById('descriptionContent');
const tasksTable = document.getElementById('tasksTable');
const tasksTitle = document.getElementById('tasksTitle');

// ========================================
// Init
// ========================================

if (!projectId || !milestoneId) {
  showError('Missing project_id or milestone_id in URL');
} else {
  fetchDetail();
}

async function fetchDetail() {
  try {
    const res = await fetch(`${API_BASE}/milestone-detail?project_id=${projectId}&milestone_id=${milestoneId}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    render(data);
  } catch (err) {
    showError(err.message);
  }
}

function showError(msg) {
  loadingState.classList.add('hidden');
  mainContent.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorMessage.textContent = msg;
}

// ========================================
// Render All
// ========================================

function render(data) {
  const { milestone, project, tasks } = data;
  const ms = milestone || {};
  const now = new Date();

  // Categorize tasks
  const completed = tasks.filter(t => isCompleted(t));
  const inProgress = tasks.filter(t => !isCompleted(t) && (t.progress || 0) > 0);
  const yetToStart = tasks.filter(t => !isCompleted(t) && (t.progress || 0) === 0);
  const overdueTasks = tasks.filter(t => {
    if (isCompleted(t)) return false;
    const due = parseDueDate(t);
    return due && due < now;
  });

  // Due date & days
  const dueDate = parseDueDate(ms);
  let daysLeft = null;
  let daysText = 'No due date';
  if (dueDate) {
    const diff = dueDate - now;
    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) daysText = `${Math.abs(daysLeft)}d overdue`;
    else if (daysLeft === 0) daysText = 'Due today';
    else if (daysLeft === 1) daysText = '1 day left';
    else daysText = `${daysLeft} days left`;
  }

  // Status
  const msCompleted = ms.status === 1 || ms.status === '1' || completed.length === tasks.length && tasks.length > 0;
  const msOverdue = !msCompleted && dueDate && dueDate < now;
  const msAtRisk = !msCompleted && !msOverdue && daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

  // === Header ===
  milestoneTitle.textContent = ms.title || ms.name || 'Milestone';
  document.title = `${ms.title || 'Milestone'} — CEO Dashboard`;

  if (msCompleted) {
    milestoneBadge.textContent = 'Completed';
    milestoneBadge.className = 'detail-badge badge-completed';
  } else if (msOverdue) {
    milestoneBadge.textContent = 'Overdue';
    milestoneBadge.className = 'detail-badge badge-overdue';
  } else if (msAtRisk) {
    milestoneBadge.textContent = 'At Risk';
    milestoneBadge.className = 'detail-badge badge-at-risk';
  } else {
    milestoneBadge.textContent = 'On Track';
    milestoneBadge.className = 'detail-badge badge-on-track';
  }

  const subtitleParts = [];
  if (project?.name) subtitleParts.push(project.name);
  if (dueDate) subtitleParts.push(`Due: ${formatDate(dueDate)}`);
  if (ms.assigned_to_fullname) subtitleParts.push(`Owner: ${esc(ms.assigned_to_fullname)}`);
  if (ms.created_ts) {
    const created = new Date(ms.created_ts * 1000);
    subtitleParts.push(`Created: ${formatDate(created)}`);
  }
  milestoneSubtitle.innerHTML = subtitleParts.join(' <span class="sep">·</span> ');

  // === Metrics ===
  metricsGrid.innerHTML = `
    <div class="metric-card metric-total">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <div class="metric-value">${tasks.length}</div>
      <div class="metric-label">Total Tasks</div>
    </div>
    <div class="metric-card metric-done">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="metric-value">${completed.length}</div>
      <div class="metric-label">Completed</div>
    </div>
    <div class="metric-card metric-wip">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
      <div class="metric-value">${inProgress.length}</div>
      <div class="metric-label">In Progress</div>
    </div>
    <div class="metric-card metric-todo">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
      </div>
      <div class="metric-value">${yetToStart.length}</div>
      <div class="metric-label">Yet to Start</div>
    </div>
    <div class="metric-card metric-overdue">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="metric-value">${overdueTasks.length}</div>
      <div class="metric-label">Overdue</div>
    </div>
    <div class="metric-card metric-days">
      <div class="metric-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="metric-value">${daysLeft !== null ? (daysLeft < 0 ? Math.abs(daysLeft) : daysLeft) : '—'}</div>
      <div class="metric-label">${daysLeft !== null ? (daysLeft < 0 ? 'Days Overdue' : 'Days Left') : 'No Deadline'}</div>
    </div>
  `;

  // === Charts ===
  renderCharts(tasks, completed, inProgress, yetToStart);

  // === Insights ===
  renderInsights(tasks, completed, inProgress, yetToStart, overdueTasks, ms, daysLeft, dueDate);

  // === Team ===
  renderTeam(tasks);

  // === Description ===
  if (ms.description && ms.description.trim()) {
    descriptionSection.classList.remove('hidden');
    descriptionContent.innerHTML = ms.description;
  }

  // === Tasks Table ===
  tasksTitle.textContent = `All Tasks (${tasks.length})`;
  renderTasksTable(tasks);

  // Show content
  loadingState.classList.add('hidden');
  mainContent.classList.remove('hidden');
}

// ========================================
// Charts
// ========================================

function renderCharts(tasks, completed, inProgress, yetToStart) {
  const total = tasks.length;
  const donut = buildDonut(completed.length, inProgress.length, yetToStart.length, total);

  // Priority breakdown
  const priorities = { High: 0, Medium: 0, Low: 0, None: 0 };
  tasks.forEach(t => {
    const p = (t.priority_title || '').toLowerCase();
    if (p === 'high' || t.priority >= 3) priorities.High++;
    else if (p === 'medium' || t.priority === 2) priorities.Medium++;
    else if (p === 'low' || t.priority === 1) priorities.Low++;
    else priorities.None++;
  });

  const maxP = Math.max(...Object.values(priorities), 1);

  chartInner.innerHTML = `
    <div class="donut-wrapper">${donut}</div>
    <div class="priority-breakdown">
      <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Priority Breakdown</div>
      ${Object.entries(priorities).map(([label, count]) => `
        <div class="priority-row">
          <span class="priority-label">${label}</span>
          <div class="priority-bar-track">
            <div class="priority-bar-fill ${label.toLowerCase()}" style="width: ${(count / maxP) * 100}%"></div>
          </div>
          <span class="priority-count">${count}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function buildDonut(comp, wip, todo, total) {
  const size = 160;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  if (total === 0) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(148,163,184,0.1)" stroke-width="${stroke}"/>
      </svg>
      <div class="donut-center"><span class="donut-value">0</span><span class="donut-label">tasks</span></div>
    `;
  }

  const segs = [
    { v: comp, c: '#10b981' },
    { v: wip, c: '#f59e0b' },
    { v: todo, c: '#334155' },
  ];

  let off = 0;
  const arcs = segs.map(s => {
    if (s.v === 0) return '';
    const d = (s.v / total) * circ;
    const g = circ - d;
    const o = off;
    off += d;
    return `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
              stroke="${s.c}" stroke-width="${stroke}"
              stroke-dasharray="${d} ${g}" stroke-dashoffset="${-o}"
              stroke-linecap="round"
              transform="rotate(-90 ${size/2} ${size/2})"/>`;
  }).join('');

  const pct = Math.round((comp / total) * 100);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(148,163,184,0.06)" stroke-width="${stroke}"/>
      ${arcs}
    </svg>
    <div class="donut-center"><span class="donut-value">${pct}%</span><span class="donut-label">done</span></div>
  `;
}

// ========================================
// Insights
// ========================================

function renderInsights(tasks, completed, inProgress, yetToStart, overdue, ms, daysLeft, dueDate) {
  const insights = [];
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Missing Description check (SMART framework)
  const hasDescription = ms.description && ms.description.trim().length > 0;
  if (!hasDescription) {
    insights.push({ icon: '💡', text: `Milestone lacks a clear definition. Consider using the <strong>SMART framework</strong> (Specific, Measurable, Achievable, Relevant, Time-bound) to define it.` });
  }

  // Completion rate
  if (pct === 100) {
    insights.push({ icon: '🎉', text: `All <strong>${total} tasks</strong> are completed. Great work!` });
  } else if (pct >= 75) {
    insights.push({ icon: '🚀', text: `<strong>${pct}%</strong> complete — almost there! ${yetToStart.length + inProgress.length} task(s) remaining.` });
  } else if (pct >= 50) {
    insights.push({ icon: '📈', text: `<strong>${pct}%</strong> complete — making good progress with ${completed.length} of ${total} tasks done.` });
  } else if (total > 0) {
    insights.push({ icon: '📋', text: `<strong>${pct}%</strong> complete — ${completed.length} of ${total} tasks done so far.` });
  }

  // Overdue tasks
  if (overdue.length > 0) {
    insights.push({ icon: '⚠️', text: `<strong>${overdue.length} task(s) overdue</strong> — need immediate attention.` });
  }

  // Deadline
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      insights.push({ icon: '🔴', text: `Milestone is <strong>${Math.abs(daysLeft)} days overdue</strong>.` });
    } else if (daysLeft <= 3 && daysLeft >= 0) {
      insights.push({ icon: '⏰', text: `Only <strong>${daysLeft} day(s) left</strong> until the deadline.` });
    } else if (daysLeft <= 7) {
      insights.push({ icon: '📅', text: `Deadline in <strong>${daysLeft} days</strong> — milestone is at risk.` });
    }
  }

  // Priority analysis
  const highPriority = tasks.filter(t => {
    const p = (t.priority_title || '').toLowerCase();
    return (p === 'high' || t.priority >= 3) && !isCompleted(t);
  });
  if (highPriority.length > 0) {
    insights.push({ icon: '🔥', text: `<strong>${highPriority.length} high-priority task(s)</strong> still pending.` });
  }

  // Team size
  const assignees = new Set();
  tasks.forEach(t => {
    if (t.assigned_to_fullname) assignees.add(t.assigned_to_fullname);
  });
  if (assignees.size > 0) {
    insights.push({ icon: '👥', text: `<strong>${assignees.size} team member(s)</strong> working on this milestone.` });
  }

  // Comments & activity
  const totalComments = tasks.reduce((sum, t) => sum + (parseInt(t.comments_count) || 0), 0);
  const totalFiles = tasks.reduce((sum, t) => sum + (parseInt(t.files_count) || 0), 0);
  if (totalComments > 0 || totalFiles > 0) {
    const parts = [];
    if (totalComments > 0) parts.push(`<strong>${totalComments}</strong> comment(s)`);
    if (totalFiles > 0) parts.push(`<strong>${totalFiles}</strong> file(s)`);
    insights.push({ icon: '💬', text: `Activity: ${parts.join(' and ')} across tasks.` });
  }

  // Pending for > 5 days (Actionable Insight)
  const pendingDelayLimit = 5;
  const longPending = tasks.filter(t => {
    if (isCompleted(t)) return false;
    const startTs = t.start_ts || t.created_ts;
    if (!startTs) return false;
    const days = Math.floor((new Date() - new Date(startTs * 1000)) / (1000 * 60 * 60 * 24));
    return days >= pendingDelayLimit;
  });

  if (longPending.length > 0) {
    const sortedPending = longPending.sort((a,b) => (a.start_ts || a.created_ts) - (b.start_ts || b.created_ts));
    const oldestTs = sortedPending[0].start_ts || sortedPending[0].created_ts;
    const oldestDays = Math.floor((new Date() - new Date(oldestTs * 1000)) / (1000 * 60 * 60 * 24));
    
    if (longPending.length === 1) {
      insights.push({ icon: '⏳', text: `Action needed: <strong>1 task</strong> ('${esc(sortedPending[0].title)}') has been pending for <strong>${oldestDays} days</strong>.` });
    } else {
      insights.push({ icon: '⏳', text: `Action needed: <strong>${longPending.length} tasks</strong> pending for >5 days (oldest is <strong>${oldestDays} days</strong>).` });
    }
  }

  // Unassigned tasks
  const unassigned = tasks.filter(t => !t.assigned_to_fullname && !isCompleted(t));
  if (unassigned.length > 0) {
    insights.push({ icon: '📌', text: `<strong>${unassigned.length} task(s)</strong> are unassigned.` });
  }

  insightsList.innerHTML = insights.map(i => `
    <div class="insight-item">
      <span class="insight-icon">${i.icon}</span>
      <span class="insight-text">${i.text}</span>
    </div>
  `).join('');
}

// ========================================
// Team
// ========================================

function renderTeam(tasks) {
  const map = {};
  tasks.forEach(t => {
    const name = t.assigned_to_fullname || 'Unassigned';
    if (!map[name]) map[name] = { total: 0, completed: 0, wip: 0, todo: 0 };
    map[name].total++;
    if (isCompleted(t)) map[name].completed++;
    else if ((t.progress || 0) > 0) map[name].wip++;
    else map[name].todo++;
  });

  const sorted = Object.entries(map).sort((a, b) => b[1].total - a[1].total);

  teamGrid.innerHTML = sorted.map(([name, data]) => {
    const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    const initials = getInitials(name);
    const color = getAvatarColor(name);
    return `
      <div class="team-card">
        <div class="team-card-header">
          <div class="team-avatar" style="background: ${color}">${initials}</div>
          <div>
            <div class="team-name">${esc(name)}</div>
            <div class="team-role">${data.total} task${data.total !== 1 ? 's' : ''} assigned</div>
          </div>
        </div>
        <div class="team-progress-info">
          <span class="team-progress-label">Completion</span>
          <span class="team-progress-pct">${pct}%</span>
        </div>
        <div class="team-progress-track">
          <div class="team-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="team-task-counts">
          <span class="team-task-tag done">✓ ${data.completed}</span>
          ${data.wip > 0 ? `<span class="team-task-tag wip">◐ ${data.wip}</span>` : ''}
          ${data.todo > 0 ? `<span class="team-task-tag todo">○ ${data.todo}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ========================================
// Tasks Table
// ========================================

function renderTasksTable(tasks) {
  const sorted = [...tasks].sort((a, b) => {
    const ac = isCompleted(a), bc = isCompleted(b);
    if (ac !== bc) return ac ? 1 : -1;
    return (b.progress || 0) - (a.progress || 0);
  });

  const rows = sorted.map(t => {
    const done = isCompleted(t);
    const wip = !done && (t.progress || 0) > 0;
    const cls = done ? 'done' : wip ? 'wip' : 'todo';
    const progress = t.progress || 0;
    const assignee = t.assigned_to_fullname || '—';
    const pTitle = (t.priority_title || 'None');
    const pClass = pTitle.toLowerCase() === 'high' ? 'high' : pTitle.toLowerCase() === 'medium' ? 'medium' : pTitle.toLowerCase() === 'low' ? 'low' : 'none';
    const dueStr = formatTaskDue(t);
    const comments = parseInt(t.comments_count) || 0;

    // Start Date & Duration logic
    const startTs = t.start_ts || t.created_ts;
    const completedTs = t.completed_ts || t.updated_ts;
    const startDateRaw = startTs ? new Date(startTs * 1000) : null;
    const startDateStr = formatDate(startDateRaw);
    
    let durationStr = '—';
    let durationCls = '';
    if (startDateRaw) {
      if (done) {
        const end = completedTs ? new Date(completedTs * 1000) : new Date();
        const days = Math.floor((end - startDateRaw) / (1000 * 60 * 60 * 24));
        durationStr = `${Math.max(0, days)}d (took)`;
        durationCls = 'text-muted';
      } else {
        const days = Math.floor((new Date() - startDateRaw) / (1000 * 60 * 60 * 24));
        durationStr = `${Math.max(0, days)}d (pending)`;
        if (days >= 5) durationCls = 'overdue'; // highlight long pending
      }
    }

    const icon = done
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : wip
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

    return `
      <tr>
        <td>
          <div class="task-name-cell">
            <div class="task-check-icon ${cls}">${icon}</div>
            <span class="task-name-text ${done ? 'completed' : ''}">${esc(t.title || 'Untitled')}</span>
          </div>
        </td>
        <td><span class="priority-tag ${pClass}">${pTitle}</span></td>
        <td>${esc(assignee)}</td>
        <td>
          <div class="task-progress-cell">
            <div class="task-bar-mini"><div class="task-bar-mini-fill ${cls}" style="width: ${progress}%"></div></div>
            <span class="task-pct">${progress}%</span>
          </div>
        </td>
        <td><span class="task-due">${startDateStr}</span></td>
        <td><span class="task-due ${durationCls}">${durationStr}</span></td>
        <td><span class="task-due ${dueStr.cls}">${dueStr.text}</span></td>
        <td>
          ${comments > 0 ? `<span class="task-comments">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${comments}
          </span>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tasksTable.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th>Progress</th>
          <th>Start Date</th>
          <th>Duration</th>
          <th>Due Date</th>
          <th>Activity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ========================================
// Helpers
// ========================================

function isCompleted(t) {
  return t.status === 1 || t.status === '1' || t.status_title === 'Completed' || t.progress === 100;
}

function parseDueDate(obj) {
  if (obj.due_ts) return new Date(obj.due_ts * 1000);
  if (obj.due_date) return typeof obj.due_date === 'number' ? new Date(obj.due_date * 1000) : new Date(obj.due_date);
  if (obj.end_date) return typeof obj.end_date === 'number' ? new Date(obj.end_date * 1000) : new Date(obj.end_date);
  return null;
}

function formatDate(d) {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTaskDue(t) {
  const d = parseDueDate(t);
  if (!d || isNaN(d.getTime())) return { text: '—', cls: '' };
  const now = new Date();
  const diff = d - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (isCompleted(t)) return { text: formatted, cls: '' };
  if (days < 0) return { text: `${formatted} (${Math.abs(days)}d late)`, cls: 'overdue' };
  if (days === 0) return { text: `${formatted} (Today)`, cls: 'soon' };
  if (days <= 3) return { text: `${formatted} (${days}d)`, cls: 'soon' };
  return { text: formatted, cls: '' };
}

function getInitials(name) {
  if (!name || name === 'Unassigned') return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
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

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
