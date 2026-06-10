// ==========================================================================
// STATE MANAGEMENT & ROUTING
// ==========================================================================
let currentTab = 'dashboard';
let activeLeadId = null;
let alertPollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  initRouting();
  initDashboard();
  initEnquiryForm();
  initWhatsAppSimulator();
  initDetailViewHandlers();
  
  // Start background alert polling (every 10 seconds)
  loadAlerts();
  alertPollInterval = setInterval(loadAlerts, 10000);
});

function initRouting() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Logo click routing
  document.querySelector('.header-logo').addEventListener('click', () => {
    switchTab('dashboard');
  });

  // Notification Icon Toggle
  const notifBtn = document.getElementById('notificationBtn');
  const notifDropdown = document.getElementById('notificationDropdown');
  
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('active');
  });
  
  document.addEventListener('click', () => {
    notifDropdown.classList.remove('active');
  });
  
  document.getElementById('markAllReadBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch('/api/alerts/read', { method: 'POST' });
      if (response.ok) {
        showToast("All alerts cleared", "success");
        loadAlerts();
      }
    } catch (err) {
      console.error(err);
    }
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  
  // Update nav buttons active state
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update visible section
  const sections = document.querySelectorAll('.tab-content');
  sections.forEach(section => {
    if (section.id === `${tabId}Tab`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Hook tab loads
  if (tabId === 'dashboard') {
    loadDashboardStats();
    loadLeads();
  } else if (tabId === 'enquiry') {
    loadWhatsAppLeadsDropdown();
  }
}

// ==========================================================================
// ALERTS & REALTIME POLLING
// ==========================================================================
let knownAlertIds = new Set();
let isFirstAlertLoad = true;

async function loadAlerts() {
  try {
    const response = await fetch('/api/alerts');
    if (!response.ok) throw new Error();
    const alerts = await response.json();
    
    // Update badge count
    const unreadCount = alerts.filter(a => !a.read).length;
    const badge = document.getElementById('alertBadge');
    badge.innerText = unreadCount;
    badge.style.display = unreadCount > 0 ? 'block' : 'none';

    // Build dropdown UI list
    const alertsList = document.getElementById('alertsList');
    if (alerts.length === 0) {
      alertsList.innerHTML = `<div class="no-alerts">No active alerts. All quiet!</div>`;
      return;
    }

    alertsList.innerHTML = '';
    alerts.forEach(alert => {
      const date = new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const item = document.createElement('div');
      item.className = `alert-item ${alert.read ? '' : 'unread'} ${alert.type}`;
      item.innerHTML = `
        <div class="alert-text">${alert.message}</div>
        <div class="alert-time">${date}</div>
      `;
      
      item.addEventListener('click', () => {
        // Mark read and open detail
        openLeadDetails(alert.leadId);
      });
      
      alertsList.appendChild(item);

      // Trigger interactive system notification toasts for new critical alerts
      if (!knownAlertIds.has(alert.id)) {
        knownAlertIds.add(alert.id);
        if (!isFirstAlertLoad && !alert.read && alert.type === 'Critical') {
          showToast(alert.message, 'critical');
          // Play a slight beep tone
          playNotificationBeep();
        }
      }
    });

    isFirstAlertLoad = false;
  } catch (err) {
    console.error("Failed to load notifications:", err);
  }
}

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime); // high frequency alert
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch(e) {}
}

// ==========================================================================
// SALES DASHBOARD CONTROLLER
// ==========================================================================
let leadsCache = [];
let dashboardView = 'list'; // 'list' or 'kanban'

function initDashboard() {
  // Load initial stats and table
  loadDashboardStats();
  loadLeads();

  // Search & Filter event listeners
  document.getElementById('searchInput').addEventListener('input', debounce(loadLeads, 300));
  document.getElementById('priorityFilter').addEventListener('change', loadLeads);
  document.getElementById('statusFilter').addEventListener('change', loadLeads);
  document.getElementById('refreshDashboardBtn').addEventListener('click', () => {
    loadDashboardStats();
    loadLeads();
    showToast("Dashboard data refreshed", "info");
  });

  // Sub Tab toggles (List vs Kanban)
  const viewListBtn = document.getElementById('viewListBtn');
  const viewKanbanBtn = document.getElementById('viewKanbanBtn');
  const listContainer = document.getElementById('listViewContainer');
  const kanbanContainer = document.getElementById('kanbanViewContainer');

  viewListBtn.addEventListener('click', () => {
    dashboardView = 'list';
    viewListBtn.classList.add('active');
    viewKanbanBtn.classList.remove('active');
    listContainer.classList.add('active');
    kanbanContainer.classList.remove('active');
    loadLeads();
  });

  viewKanbanBtn.addEventListener('click', () => {
    dashboardView = 'kanban';
    viewKanbanBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    kanbanContainer.classList.add('active');
    listContainer.classList.remove('active');
    loadLeads();
  });

  // Make load stats available globally for components drop helper
  window.loadDashboardStats = loadDashboardStats;
}

async function loadDashboardStats() {
  try {
    const response = await fetch('/api/dashboard/stats');
    if (!response.ok) throw new Error();
    const stats = await response.json();

    document.getElementById('statTotalLeads').innerText = stats.totalLeads;
    document.getElementById('statHotLeads').innerText = stats.hotLeads;
    document.getElementById('statWarmLeads').innerText = stats.warmLeads;
    
    // Format Pipeline in Lakhs
    const pipelineLakhs = (stats.pipelineValue / 100000).toFixed(1);
    document.getElementById('statPipelineValue').innerText = `₹${pipelineLakhs} Lakhs`;
  } catch (err) {
    console.error("Could not fetch stats:", err);
  }
}

async function loadLeads() {
  try {
    const search = document.getElementById('searchInput').value;
    const priority = document.getElementById('priorityFilter').value;
    const status = document.getElementById('statusFilter').value;
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (priority) params.append('priority', priority);
    if (status) params.append('status', status);

    const response = await fetch(`/api/leads?${params.toString()}`);
    if (!response.ok) throw new Error();
    const leads = await response.json();
    leadsCache = leads;

    if (dashboardView === 'list') {
      renderLeadsTable(leads);
    } else {
      renderKanbanBoard(leads);
    }
  } catch (err) {
    console.error("Could not load leads:", err);
  }
}

function renderLeadsTable(leads) {
  const tbody = document.getElementById('leadsTableBody');
  const emptyState = document.getElementById('listEmptyState');
  tbody.innerHTML = '';

  if (leads.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  leads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="lead-name-col">${lead.name} <span class="lead-phone-sub">${lead.phone}</span></td>
      <td><span class="lead-badge ${lead.priority.toLowerCase()}">${lead.priority}</span></td>
      <td>
        <span class="score-pill">
          <span class="score-indicator-dot ${lead.priority.toLowerCase()}-dot"></span>
          ${lead.score}%
        </span>
      </td>
      <td>${lead.location}</td>
      <td style="font-weight: 700; color:#38bdf8;">₹${(lead.budget / 100000).toFixed(1)} L</td>
      <td>${lead.timeline}</td>
      <td><span class="agent-label"><i class="fa-solid fa-user-tie"></i> ${lead.agentName || 'Auto Queue'}</span></td>
      <td><span class="status-badge ${lead.status.toLowerCase()}">${lead.status}</span></td>
      <td><button class="table-action-btn">Inspect</button></td>
    `;
    
    // Clicking row opens detail page
    tr.addEventListener('click', () => openLeadDetails(lead.id));
    // Load agent info from list
    const agentLabel = tr.querySelector('.agent-label');
    fetchAgentName(lead.assignedAgentId, agentLabel);

    tbody.appendChild(tr);
  });
}

async function fetchAgentName(agentId, element) {
  if (!agentId) {
    element.innerHTML = '<i class="fa-solid fa-user-clock"></i> Auto Queue';
    return;
  }
  try {
    const res = await fetch('/api/agents');
    if (res.ok) {
      const agents = await res.json();
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        element.innerHTML = `<i class="fa-solid fa-user-tie"></i> ${agent.name}`;
      }
    }
  } catch(e){}
}

function renderKanbanBoard(leads) {
  const columns = ['New', 'Assigned', 'Contacted', 'Nurturing', 'Converted'];
  
  // Clear lists
  columns.forEach(col => {
    document.getElementById(`list-${col}`).innerHTML = '';
    document.getElementById(`count-${col}`).innerText = '0';
  });

  const columnCounters = { New: 0, Assigned: 0, Contacted: 0, Nurturing: 0, Converted: 0 };

  leads.forEach(lead => {
    // Determine target column (handling lost/unmapped statuses as New or closest match)
    let col = lead.status;
    if (!columns.includes(col)) {
      if (col === 'Lost') return; // Hide lost from board or show in red
      col = 'New';
    }

    const card = document.createElement('div');
    card.className = `kanban-card ${lead.priority.toLowerCase()}-border`;
    card.id = `kanban-card-${lead.id}`;
    card.draggable = true;
    card.addEventListener('dragstart', drag);
    card.addEventListener('dragend', dragEnd);
    
    // Card Click routes to details
    card.addEventListener('click', () => openLeadDetails(lead.id));

    card.innerHTML = `
      <div class="kanban-card-header">
        <span class="kanban-lead-name">${lead.name}</span>
        <span class="lead-badge ${lead.priority.toLowerCase()}" style="font-size: 0.65rem; padding: 2px 4px;">${lead.priority}</span>
      </div>
      <div class="kanban-card-budget">₹${(lead.budget / 100000).toFixed(1)} Lakhs</div>
      <div class="kanban-card-location"><i class="fa-solid fa-location-dot"></i> ${lead.location}</div>
      <div class="kanban-card-footer">
        <span class="kanban-agent" id="kanban-agent-${lead.id}"><i class="fa-solid fa-user-astronaut"></i> Loading...</span>
        <span class="score-pill" style="font-size:0.75rem;">${lead.score}%</span>
      </div>
    `;

    document.getElementById(`list-${col}`).appendChild(card);
    columnCounters[col]++;
    
    // Resolve agent label
    const agentEl = card.querySelector(`#kanban-agent-${lead.id}`);
    fetchAgentName(lead.assignedAgentId, agentEl);
  });

  // Render column totals
  columns.forEach(col => {
    document.getElementById(`count-${col}`).innerText = columnCounters[col];
  });
}

// ==========================================================================
// CLIENT FORM ENQUIRY SUBMISSION
// ==========================================================================
function initEnquiryForm() {
  const slider = document.getElementById('leadBudget');
  const output = document.getElementById('budgetValue');
  
  // Budget slider interaction
  slider.addEventListener('input', () => {
    const val = Number(slider.value);
    if (val >= 10000000) {
      output.innerText = '₹1 Crore';
    } else {
      output.innerText = `₹${(val / 100000).toFixed(0)} Lakhs`;
    }
  });

  const form = document.getElementById('leadEntryForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitFormBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.loading-spinner');
    
    // Loading state
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    submitBtn.disabled = true;

    try {
      const payload = {
        name: document.getElementById('leadName').value,
        phone: document.getElementById('leadPhone').value,
        email: document.getElementById('leadEmail').value,
        source: document.getElementById('leadSource').value,
        budget: Number(slider.value),
        location: document.getElementById('leadLocation').value,
        timeline: document.getElementById('leadTimeline').value,
        notes: document.getElementById('leadNotes').value
      };

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit enquiry");
      }

      const qualifiedLead = await response.json();
      
      showToast(`Enquiry submitted successfully! Qualified as ${qualifiedLead.priority}`, 'success');
      form.reset();
      slider.value = 3000000;
      output.innerText = '₹30 Lakhs';
      
      // Reload stats and route
      loadDashboardStats();
      loadWhatsAppLeadsDropdown();
      
      // Navigate to details or dashboard
      setTimeout(() => {
        openLeadDetails(qualifiedLead.id);
      }, 1000);

    } catch (err) {
      showToast(err.message, 'critical');
    } finally {
      btnText.style.display = 'inline-block';
      spinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
}

// ==========================================================================
// WHATSAPP CHAT SIMULATOR
// ==========================================================================
function initWhatsAppSimulator() {
  const dropdown = document.getElementById('chatLeadSelect');
  const sendBtn = document.getElementById('whatsappSendBtn');
  const inputField = document.getElementById('whatsappInputField');

  dropdown.addEventListener('change', () => {
    loadChatHistory(dropdown.value);
  });

  sendBtn.addEventListener('click', sendSimulatorMessage);
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendSimulatorMessage();
  });
}

async function loadWhatsAppLeadsDropdown(selectLeadId = null) {
  try {
    const dropdown = document.getElementById('chatLeadSelect');
    const response = await fetch('/api/leads');
    if (!response.ok) throw new Error();
    const leads = await response.json();

    dropdown.innerHTML = '';
    if (leads.length === 0) {
      dropdown.innerHTML = '<option value="">No Active Leads</option>';
      return;
    }

    leads.forEach(lead => {
      const opt = document.createElement('option');
      opt.value = lead.id;
      opt.innerText = `${lead.name} (${lead.phone}) - [${lead.priority}]`;
      dropdown.appendChild(opt);
    });

    if (selectLeadId) {
      dropdown.value = selectLeadId;
    }
    
    // Load initial chat
    loadChatHistory(dropdown.value);
  } catch (err) {
    console.error(err);
  }
}

async function loadChatHistory(leadId) {
  if (!leadId) {
    document.getElementById('whatsappChatBody').innerHTML = `
      <div style="text-align:center; padding: 2rem; color: #8696a0; font-size: 0.85rem;">
        Create or select a client lead to begin simulation.
      </div>`;
    return;
  }
  
  try {
    const chatBody = document.getElementById('whatsappChatBody');
    const response = await fetch(`/api/leads/${leadId}/chat`);
    if (!response.ok) throw new Error();
    const chats = await response.json();

    chatBody.innerHTML = '';
    
    if (chats.length === 0) {
      chatBody.innerHTML = `
        <div style="text-align:center; padding: 1rem; color: #8696a0; font-size: 0.75rem;">
          Secure chat initiated. Say 'Hello' to begin AI qualification.
        </div>`;
      return;
    }

    chats.forEach(chat => {
      const bubble = document.createElement('div');
      bubble.className = `wa-bubble ${chat.sender}`;
      
      const time = new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      bubble.innerHTML = `
        <div class="wa-bubble-text">${chat.message}</div>
        <span class="wa-bubble-time">${time}</span>
      `;
      chatBody.appendChild(bubble);
    });

    // Auto scroll bottom
    chatBody.scrollTop = chatBody.scrollHeight;
  } catch (err) {
    console.error(err);
  }
}

async function sendSimulatorMessage() {
  const dropdown = document.getElementById('chatLeadSelect');
  const leadId = dropdown.value;
  if (!leadId) return;

  const inputField = document.getElementById('whatsappInputField');
  const message = inputField.value.trim();
  if (!message) return;

  // Clear input
  inputField.value = '';

  try {
    const payload = {
      sender: 'buyer',
      message: message
    };

    // Render bubble locally for snappiness
    const chatBody = document.getElementById('whatsappChatBody');
    const localBubble = document.createElement('div');
    localBubble.className = 'wa-bubble buyer';
    localBubble.innerHTML = `
      <div class="wa-bubble-text">${message}</div>
      <span class="wa-bubble-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    chatBody.appendChild(localBubble);
    chatBody.scrollTop = chatBody.scrollHeight;

    // Send to server
    const response = await fetch(`/api/leads/${leadId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      // Reload chat after brief delay to catch the bot reply bubble
      setTimeout(() => {
        loadChatHistory(leadId);
        // Play slight double tone for message incoming
        playMessageIncomingTone();
      }, 1500);
    }

  } catch (err) {
    showToast("Chat connection lost", "critical");
  }
}

function playMessageIncomingTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 WhatsApp tone
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {}
}

// ==========================================================================
// LEAD INSPECTOR PAGE (DETAIL VIEW)
// ==========================================================================
async function openLeadDetails(leadId) {
  activeLeadId = leadId;
  switchTab('detail');
  
  try {
    const response = await fetch(`/api/leads/${leadId}`);
    if (!response.ok) throw new Error("Failed to load details");
    const lead = await response.json();
    
    // Render text fields
    document.getElementById('detailName').innerText = lead.name;
    document.getElementById('detailEmail').innerText = lead.email || 'N/A';
    document.getElementById('detailPhone').innerText = lead.phone;
    document.getElementById('detailBudget').innerText = `₹${(lead.budget / 100000).toFixed(1)} Lakhs`;
    document.getElementById('detailLocation').innerText = lead.location;
    document.getElementById('detailTimeline').innerText = lead.timeline;
    document.getElementById('detailSource').innerText = lead.source;
    
    const formattedDate = new Date(lead.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('detailCreatedDate').innerText = formattedDate;

    // Badges & Gauges
    const priorityBadge = document.getElementById('detailPriorityBadge');
    priorityBadge.className = `lead-badge ${lead.priority.toLowerCase()}`;
    priorityBadge.innerText = lead.priority;

    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `status-badge ${lead.status.toLowerCase()}`;
    statusBadge.innerText = lead.status;

    // SVG Score Gauge
    const circle = document.getElementById('detailScoreCircle');
    const label = document.getElementById('detailScoreNumber');
    renderScoreGauge(circle, label, lead.score);

    // Sales Agent details
    const agentName = document.getElementById('detailAssignedAgentName');
    const agentContact = document.getElementById('detailAssignedAgentContact');
    if (lead.assignedAgent) {
      agentName.innerText = lead.assignedAgent.name;
      agentContact.innerText = `${lead.assignedAgent.phone} | ${lead.assignedAgent.email}`;
    } else {
      agentName.innerText = "Unassigned";
      agentContact.innerText = "No sales agent allocated yet";
    }

    // Populate Reassignment Dropdown
    const agentDropdown = document.getElementById('agentSelectDropdown');
    agentDropdown.innerHTML = '<option value="">Choose Agent...</option>';
    lead.availableAgents.forEach(agent => {
      const opt = document.createElement('option');
      opt.value = agent.id;
      opt.innerText = `${agent.name} (Active Loads: ${agent.activeLeads || 0})`;
      if (lead.assignedAgentId === agent.id) {
        opt.selected = true;
      }
      agentDropdown.appendChild(opt);
    });

    // AI Copilot Summary Card
    document.getElementById('aiSummaryText').innerText = lead.aiSummary || "Run qualification to analyze user profile details.";
    document.getElementById('aiActionText').innerText = lead.aiSuggestedAction || "Analyze lead profile to generate action guidance.";
    
    // Copy Center Templates
    document.getElementById('whatsappTemplateText').value = lead.whatsappTemplate || "";
    document.getElementById('emailTemplateSubject').innerText = lead.emailSubject || "Proposal details";
    document.getElementById('emailTemplateBody').value = lead.emailBody || "";

    // History Timeline
    renderTimeline(lead.followUps);

  } catch (err) {
    showToast(err.message, "critical");
    switchTab('dashboard');
  }
}

function renderTimeline(followUps) {
  const container = document.getElementById('leadTimeline');
  container.innerHTML = '';
  
  if (!followUps || followUps.length === 0) {
    container.innerHTML = `<div style="padding: 1rem 0; color: #64748b; font-size: 0.85rem;">No historical logs found.</div>`;
    return;
  }

  // Sort timeline: newest first
  const sorted = followUps.sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(item => {
    const formattedDate = new Date(item.date).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = `timeline-item ${item.type}`;
    div.innerHTML = `
      <div class="timeline-node"></div>
      <div class="timeline-content">
        <div class="timeline-meta">
          <span class="timeline-type"><strong>${getIconForAction(item.type)} ${item.type}</strong> (${item.status})</span>
          <span class="timeline-date">${formattedDate}</span>
        </div>
        <div class="timeline-notes">${item.notes}</div>
        <div class="timeline-agent-tag" style="font-size:0.7rem; color:#64748b; margin-top:0.25rem;">
          By: ${item.agentName}
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function getIconForAction(type) {
  switch(type) {
    case 'Call': return '📞';
    case 'WhatsApp': return '💬';
    case 'Email': return '📧';
    case 'Site Visit': return '🏗️';
    case 'Negotiation': return '🤝';
    case 'System alert': return '⚙️';
    default: return '📝';
  }
}

function initDetailViewHandlers() {
  document.getElementById('backToDashboardBtn').addEventListener('click', () => {
    switchTab('dashboard');
  });

  // Re-run AI analysis
  document.getElementById('reprocessLeadBtn').addEventListener('click', async () => {
    if (!activeLeadId) return;
    try {
      showToast("Reprocessing AI scores...", "info");
      const res = await fetch(`/api/leads/${activeLeadId}/process`, { method: 'POST' });
      if (res.ok) {
        showToast("Lead qualification updated", "success");
        openLeadDetails(activeLeadId);
      }
    } catch(err){}
  });

  // Delete Lead
  document.getElementById('deleteLeadBtn').addEventListener('click', async () => {
    if (!activeLeadId) return;
    if (confirm("Are you sure you want to permanently delete this lead record? This action cascades to follow-ups, chat files, and alerts.")) {
      try {
        const res = await fetch(`/api/leads/${activeLeadId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast("Lead permanently deleted", "success");
          switchTab('dashboard');
        }
      } catch(err){}
    }
  });

  // Assign Agent button
  document.getElementById('assignAgentBtn').addEventListener('click', async () => {
    if (!activeLeadId) return;
    const dropdown = document.getElementById('agentSelectDropdown');
    const agentId = dropdown.value;
    if (!agentId) return;

    try {
      const res = await fetch(`/api/leads/${activeLeadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });
      if (res.ok) {
        showToast("Sales agent assigned successfully", "success");
        openLeadDetails(activeLeadId);
      }
    } catch(err){}
  });

  // Log follow-up form submit
  const followUpForm = document.getElementById('logFollowupForm');
  followUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeLeadId) return;

    try {
      // Get current logged in user (or assigned agent)
      const agentDropdown = document.getElementById('agentSelectDropdown');
      const agentName = agentDropdown.options[agentDropdown.selectedIndex]?.text.split(' (')[0] || "Priya Patel";

      const payload = {
        agentName,
        type: document.getElementById('followupType').value,
        status: document.getElementById('followupStatus').value,
        notes: document.getElementById('followupNotes').value
      };

      const res = await fetch(`/api/leads/${activeLeadId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("Follow-up logged successfully", "success");
        followUpForm.reset();
        openLeadDetails(activeLeadId);
      }
    } catch(err){}
  });

  // AI Templates Copy Center Toggles
  const copyTabs = document.querySelectorAll('.copy-tab-btn');
  copyTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-copytab');
      copyTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.getElementById('waCopyPanel').classList.remove('active');
      document.getElementById('emailCopyPanel').classList.remove('active');

      if (target === 'wa') {
        document.getElementById('waCopyPanel').classList.add('active');
      } else {
        document.getElementById('emailCopyPanel').classList.add('active');
      }
    });
  });

  // Copy buttons
  document.getElementById('copyWaBtn').addEventListener('click', () => {
    const text = document.getElementById('whatsappTemplateText').value;
    navigator.clipboard.writeText(text);
    showToast("WhatsApp text template copied to clipboard", "success");
  });

  document.getElementById('copyEmailBtn').addEventListener('click', () => {
    const subject = document.getElementById('emailTemplateSubject').innerText;
    const body = document.getElementById('emailTemplateBody').value;
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    showToast("Email Subject & Proposal copied to clipboard", "success");
  });

  document.getElementById('sendSimulationWaBtn').addEventListener('click', () => {
    if (!activeLeadId) return;
    
    // Route to client portal / chat tab and load this lead in active simulation
    loadWhatsAppLeadsDropdown(activeLeadId);
    switchTab('enquiry');
    
    // Simulate auto-inserting the generated copilot follow-up draft in input box
    const draft = document.getElementById('whatsappTemplateText').value;
    const inputField = document.getElementById('whatsappInputField');
    inputField.value = draft;
    
    showToast("AI proposal loaded into WhatsApp simulator box!", "success");
  });
}

// ==========================================================================
// UTILITY HELPERS
// ==========================================================================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
