// Standalone Vercel Serverless Function
// Bypasses Express entirely — directly handles API routing for Vercel
require('dotenv').config();
const crypto = require('crypto');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const BASE_URL = 'https://freedcamp.com/api/v1';

function getAuthParams() {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHmac('sha1', API_SECRET)
    .update(API_KEY + timestamp)
    .digest('hex');
  return { api_key: API_KEY, timestamp, hash };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function freedcampFetch(endpoint, params = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const authParams = getAuthParams();
    const allParams = { ...authParams, ...params };
    const qs = Object.entries(allParams).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${BASE_URL}/${endpoint}?${qs}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429 && attempt < retries) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      const text = await response.text();
      throw new Error(`Freedcamp API error (${response.status}): ${text}`);
    }
    return response.json();
  }
}

// ========== Route Handlers ==========

async function handleDashboard(res) {
  const projectsData = await freedcampFetch('projects');
  const projects = projectsData.data?.projects || projectsData.projects || [];
  let projectList = Array.isArray(projects) ? projects : Object.values(projects);

  // Whitelisted projects: always include even if archived
  const WHITELISTED_PROJECT_IDS = ['3167931', '3557310']; // Varna, Tshirt

  projectList = projectList.filter(p => {
    const pid = String(p.project_id || p.id);
    if (WHITELISTED_PROJECT_IDS.includes(pid)) return true;
    if (p.f_active === false || p.f_active === 'false') return false;
    if (p.archived_ts && p.archived_ts !== 0 && p.archived_ts !== '0') return false;
    return true;
  });

  const allMilestones = [];
  const activeProjects = [];

  for (const project of projectList) {
    const pid = project.project_id || project.id;
    try {
      const msData = await freedcampFetch('milestones', { project_id: pid });
      const milestones = msData.data?.milestones || msData.milestones || [];
      let milestoneList = Array.isArray(milestones) ? milestones : Object.values(milestones);
      const activeMilestones = milestoneList.filter(ms => {
        if (ms.archived === 1 || ms.archived === '1' || ms.archived === true) return false;
        if (ms.is_archived === 1 || ms.is_archived === '1' || ms.is_archived === true) return false;
        if (ms.archived_ts && ms.archived_ts !== '0' && ms.archived_ts !== 0) return false;
        return true;
      });
      if (activeMilestones.length > 0) {
        const projectName = project.project_name || project.name || `Project ${pid}`;
        activeProjects.push({ id: pid, name: projectName });
        activeMilestones.forEach(ms => allMilestones.push({ ...ms, project_id: pid, project_name: projectName }));
      }
    } catch (e) {
      if (!e.message.includes('No access to the app')) {
        console.warn(`Skipping project ${pid}: ${e.message}`);
      }
    }
    await delay(800);
  }

  return res.status(200).json({ projects: activeProjects, milestones: allMilestones, total: allMilestones.length });
}

async function handleTasks(req, res) {
  const { project_id, milestone_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  const params = { project_id };
  if (milestone_id) params.milestone_id = milestone_id;
  const data = await freedcampFetch('tasks', params);
  let tasks = data.data?.tasks || data.tasks || [];
  if (!Array.isArray(tasks) && typeof tasks === 'object') tasks = Object.values(tasks);
  if (milestone_id) {
    const msId = String(milestone_id);
    tasks = tasks.filter(t => String(t.ms_id || '') === msId);
  }
  return res.status(200).json({ tasks });
}

async function handleMilestoneDetail(req, res) {
  const { project_id, milestone_id } = req.query;
  if (!project_id || !milestone_id) return res.status(400).json({ error: 'project_id and milestone_id are required' });

  const msData = await freedcampFetch('milestones', { project_id });
  const milestones = msData.data?.milestones || msData.milestones || [];
  let milestoneList = Array.isArray(milestones) ? milestones : Object.values(milestones);
  const milestone = milestoneList.find(ms => String(ms.id) === String(milestone_id)) || null;

  const projectsData = await freedcampFetch('projects');
  const projects = projectsData.data?.projects || projectsData.projects || [];
  let projectList = Array.isArray(projects) ? projects : Object.values(projects);
  const project = projectList.find(p => String(p.project_id || p.id) === String(project_id)) || null;

  const taskData = await freedcampFetch('tasks', { project_id });
  let tasks = taskData.data?.tasks || taskData.tasks || [];
  if (!Array.isArray(tasks) && typeof tasks === 'object') tasks = Object.values(tasks);
  tasks = tasks.filter(t => String(t.ms_id || '') === String(milestone_id));

  return res.status(200).json({ milestone, project, tasks });
}

// ========== Main Handler ==========

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse the route from the URL path
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\//, '');

  try {
    switch (path) {
      case 'dashboard': return await handleDashboard(res);
      case 'tasks': return await handleTasks(req, res);
      case 'milestone-detail': return await handleMilestoneDetail(req, res);
      default: return res.status(404).json({ error: `Unknown API route: ${path}` });
    }
  } catch (err) {
    console.error('API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
