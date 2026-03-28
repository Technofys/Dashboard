require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const BASE_URL = 'https://freedcamp.com/api/v1';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Generate Freedcamp auth params (HMAC-SHA1)
function getAuthParams() {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHmac('sha1', API_SECRET)
    .update(API_KEY + timestamp)
    .digest('hex');
  return { api_key: API_KEY, timestamp, hash };
}

// Generic Freedcamp API fetcher with retry logic
async function freedcampFetch(endpoint, params = {}, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const authParams = getAuthParams();
    const allParams = { ...authParams, ...params };
    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${BASE_URL}/${endpoint}?${queryString}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429 && attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited (429) for ${endpoint}. Retrying in ${backoff}ms...`);
        await delay(backoff);
        continue;
      }
      throw new Error(`Freedcamp API error (${response.status}): ${text}`);
    }
    return response.json();
  }
}

// GET /api/projects — List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const data = await freedcampFetch('projects');
    res.json(data);
  } catch (err) {
    console.error('Error fetching projects:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/milestones?project_id=xxx — List milestones for a project
app.get('/api/milestones', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    const data = await freedcampFetch('milestones', { project_id });
    res.json(data);
  } catch (err) {
    console.error('Error fetching milestones:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/debug — Show raw API response for debugging
app.get('/api/debug', async (req, res) => {
  try {
    const projectsData = await freedcampFetch('projects');
    console.log('Raw projects response keys:', JSON.stringify(Object.keys(projectsData)));
    
    // Try to find projects in the response
    const projects = projectsData.data?.projects || projectsData.projects || [];
    let projectList = [];
    if (Array.isArray(projects)) {
      projectList = projects;
    } else if (typeof projects === 'object') {
      projectList = Object.values(projects);
    }
    
    // Log first project structure for debugging
    if (projectList.length > 0) {
      console.log('First project keys:', JSON.stringify(Object.keys(projectList[0])));
      console.log('First project:', JSON.stringify(projectList[0], null, 2));
    }

    // Try milestones for first project
    let sampleMilestones = null;
    if (projectList.length > 0) {
      const pid = projectList[0].project_id || projectList[0].id;
      try {
        const msData = await freedcampFetch('milestones', { project_id: pid });
        console.log('Raw milestones response keys:', JSON.stringify(Object.keys(msData)));
        sampleMilestones = msData;
      } catch (e) {
        sampleMilestones = { error: e.message };
      }
    }

    res.json({
      raw_projects_keys: Object.keys(projectsData),
      project_count: projectList.length,
      first_project: projectList[0] || null,
      sample_milestones: sampleMilestones,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In-memory cache for milestone data
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper: sequential delay
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// GET /api/milestones/all — Fetch milestones across ALL active projects (sequential, cached)
app.get('/api/milestones/all', async (req, res) => {
  try {
    // Return cached data if fresh
    if (cachedData && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      return res.json(cachedData);
    }

    // Step 1: Get all projects
    const projectsData = await freedcampFetch('projects');
    const projects = projectsData.data?.projects || projectsData.projects || [];

    // Normalize projects to an array
    let projectList = [];
    if (Array.isArray(projects)) {
      projectList = projects;
    } else if (typeof projects === 'object') {
      projectList = Object.values(projects);
    }

    // Filter out archived projects
    // Freedcamp uses archived_ts (non-null = archived) and f_active (false = archived)
    projectList = projectList.filter(p => {
      // If f_active is explicitly false, it's archived
      if (p.f_active === false || p.f_active === 'false') return false;
      // If archived_ts has a value (not null/undefined/0), it's archived
      if (p.archived_ts && p.archived_ts !== 0 && p.archived_ts !== '0') return false;
      return true;
    });

    console.log(`Found ${projectList.length} active projects (archived excluded)`);

    // Step 2: Fetch milestones SEQUENTIALLY with delay to avoid rate limits
    const allMilestones = [];
    const activeProjects = []; // Only projects that have milestones

    for (const project of projectList) {
      const pid = project.project_id || project.id;
      try {
        const msData = await freedcampFetch('milestones', { project_id: pid });
        const milestones = msData.data?.milestones || msData.milestones || [];

        let milestoneList = [];
        if (Array.isArray(milestones)) {
          milestoneList = milestones;
        } else if (typeof milestones === 'object') {
          milestoneList = Object.values(milestones);
        }

        // Filter out archived milestones
        const activeMilestones = milestoneList.filter(ms => {
          if (ms.archived === 1 || ms.archived === '1' || ms.archived === true) return false;
          if (ms.is_archived === 1 || ms.is_archived === '1' || ms.is_archived === true) return false;
          if (ms.archived_ts && ms.archived_ts !== '0' && ms.archived_ts !== 0) return false;
          return true;
        });

        if (activeMilestones.length > 0) {
          const projectName = project.project_name || project.name || `Project ${pid}`;
          activeProjects.push({ id: pid, name: projectName });
          activeMilestones.forEach(ms => {
            allMilestones.push({
              ...ms,
              project_id: pid,
              project_name: projectName,
            });
          });
          console.log(`  ✓ ${projectName}: ${activeMilestones.length} milestone(s)`);
        }
      } catch (e) {
        // Silently skip projects without milestones app access
        if (!e.message.includes('No access to the app')) {
          console.warn(`  ✗ Skipping project ${pid}: ${e.message}`);
        }
      }
      // Sleep a bit longer to prevent hitting the strict 60/min rate limits
      await delay(800);
    }

    console.log(`Total: ${allMilestones.length} milestones across ${activeProjects.length} projects`);

    const responseData = {
      projects: activeProjects,
      milestones: allMilestones,
      total: allMilestones.length,
    };

    // Cache the response
    cachedData = responseData;
    cacheTimestamp = Date.now();

    res.json(responseData);
  } catch (err) {
    console.error('Error fetching all milestones:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks?project_id=xxx&milestone_id=xxx — List tasks for a milestone
app.get('/api/tasks', async (req, res) => {
  try {
    const { project_id, milestone_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    
    const params = { project_id };
    if (milestone_id) {
      params.milestone_id = milestone_id;
    }
    
    const data = await freedcampFetch('tasks', params);
    
    // Handle the task data format properly
    let tasks = data.data?.tasks || data.tasks || [];
    if (!Array.isArray(tasks) && typeof tasks === 'object') {
      tasks = Object.values(tasks);
    }
    
    // Filter tasks to only include those belonging to the requested milestone
    // Freedcamp API may not reliably filter by milestone_id, so we filter by ms_id
    if (milestone_id) {
      const msId = String(milestone_id);
      tasks = tasks.filter(t => String(t.ms_id || '') === msId);
    }
    
    res.json({ tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/milestone-detail?project_id=xxx&milestone_id=xxx — Full milestone detail with tasks
app.get('/api/milestone-detail', async (req, res) => {
  try {
    const { project_id, milestone_id } = req.query;
    if (!project_id || !milestone_id) {
      return res.status(400).json({ error: 'project_id and milestone_id are required' });
    }

    // Get milestone data from the milestones endpoint
    const msData = await freedcampFetch('milestones', { project_id });
    let milestones = msData.data?.milestones || msData.milestones || [];
    if (!Array.isArray(milestones) && typeof milestones === 'object') {
      milestones = Object.values(milestones);
    }
    const milestone = milestones.find(m => String(m.id) === String(milestone_id));

    // Get project info
    const projectsData = await freedcampFetch('projects');
    const projects = projectsData.data?.projects || projectsData.projects || [];
    let projectList = Array.isArray(projects) ? projects : Object.values(projects);
    const project = projectList.find(p => String(p.project_id || p.id) === String(project_id));

    // Get tasks for this milestone
    const taskData = await freedcampFetch('tasks', { project_id });
    let tasks = taskData.data?.tasks || taskData.tasks || [];
    if (!Array.isArray(tasks) && typeof tasks === 'object') {
      tasks = Object.values(tasks);
    }
    // Filter to only tasks in this milestone
    tasks = tasks.filter(t => String(t.ms_id || '') === String(milestone_id));

    res.json({
      milestone: milestone || null,
      project: project ? { id: project.project_id || project.id, name: project.project_name || project.name } : null,
      tasks,
    });
  } catch (err) {
    console.error('Error fetching milestone detail:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fallback: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback route has been moved below /api/tasks

app.listen(PORT, () => {
  console.log(`🚀 CEO Dashboard running at http://localhost:${PORT}`);
});
