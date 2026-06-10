// ==========================================================================
// SYSTEM ALERTS & TOASTS
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type.toLowerCase()}`;

  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type.toLowerCase() === 'success') {
    icon = '<i class="fa-solid fa-circle-check"></i>';
  } else if (type.toLowerCase() === 'critical') {
    icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  }

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================================================
// SCORE GAUGE CIRCLE RENDERER
// ==========================================================================
function renderScoreGauge(circleElement, numberElement, score) {
  if (!circleElement || !numberElement) return;

  // Set the percentage score number
  numberElement.innerText = Math.round(score);

  // Calculate Dashoffset based on score
  // Circumference = 2 * PI * r = 2 * 3.14159 * 38 = 238.76
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  circleElement.style.strokeDasharray = `${circumference}`;
  circleElement.style.strokeDashoffset = `${offset}`;

  // Set color color variable matching priority
  if (score >= 75) {
    circleElement.style.stroke = '#d4af37'; // Gold
  } else if (score >= 40) {
    circleElement.style.stroke = '#dfc38a'; // Champagne Gold
  } else {
    circleElement.style.stroke = '#795548'; // Bronze Brown
  }
}

// ==========================================================================
// KANBAN DRAG AND DROP HANDLERS
// ==========================================================================
function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData("text/plain", ev.target.id);
  ev.target.style.opacity = "0.5";
}

function dragEnd(ev) {
  ev.target.style.opacity = "1";
}

async function drop(ev, newStatus) {
  ev.preventDefault();
  const leadCardId = ev.dataTransfer.getData("text/plain");
  const cardElement = document.getElementById(leadCardId);
  if (!cardElement) return;

  const leadId = leadCardId.replace('kanban-card-', '');
  
  try {
    // Call API to update status
    const response = await fetch(`/api/leads/${leadId}`, {
      method: 'GET'
    });
    if (!response.ok) throw new Error("Could not find lead details");
    const leadDetails = await response.json();
    
    // Perform update
    const updateResponse = await fetch(`/api/leads/${leadId}`, {
      method: 'POST', // Repurpose process or update
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leadDetails, status: newStatus })
    });
    
    // Note: since our express API has routes for process and follow-ups, we can make a custom update route
    // Wait, let's create a custom update path or patch directly. In routes.js, we support POST /leads/:id/assign
    // and POST /leads/:id/followup. Let's make sure our routes also support a status update PATCH or we can
    // just call an endpoint to update status. Wait! In routes.js, does it have an endpoint to update status?
    // Let's check:
    // We have:
    // router.post('/leads/:id/assign', (req, res) => { ... })
    // router.post('/leads/:id/followup', (req, res) => { ... }) which auto-transitions status.
    // What if we add a status change in backend? Let's check routes.js! Oh, routes.js has no explicit PATCH/PUT lead route,
    // but we can add a simple follow-up of type "System" that changes status, or we can just add a route.
    // Wait! Let's check if we can add a route or if we can make POST /leads/:id/process handle a status payload, 
    // or log a follow-up that changes it.
    // Let's add a PATCH /api/leads/:id route to update general lead details like status, budget, etc.
    // Oh, since we are in public/js/components.js, let's see how we will call the API.
    // We can make a PATCH request to /api/leads/:id. Wait! We should make sure routes.js has this route.
    // Let's write the PATCH route in routes.js later or make a general POST route for state edits.
    // Actually, let's review: we can make a POST request to `/api/leads/${leadId}/status` or just update via PATCH `/api/leads/${leadId}`.
    // Let's modify routes.js to support PATCH `/api/leads/:id` to make it super elegant and full-featured!
    // Yes, we will modify routes.js to add PATCH /api/leads/:id.
    
    const patchResponse = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (patchResponse.ok) {
      // Move card visually
      const targetList = document.getElementById(`list-${newStatus}`);
      targetList.appendChild(cardElement);
      
      // Update count tags
      showToast(`Lead status updated to ${newStatus}`, 'success');
      
      // Trigger dashboard reload stats
      if (window.loadDashboardStats) {
        window.loadDashboardStats();
      }
    } else {
      throw new Error("API failed to update status");
    }
  } catch (err) {
    console.error("Drop failed:", err);
    showToast("Failed to update lead status. Please try again.", "critical");
  }
}
