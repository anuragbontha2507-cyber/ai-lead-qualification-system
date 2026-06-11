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
// AUDIO SYNTHESIZER ACTIONS
// ==========================================================================
function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.04, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.start(time);
      osc.stop(time + duration);
    };
    const now = ctx.currentTime;
    playNote(523.25, now, 0.3);       // C5
    playNote(659.25, now + 0.08, 0.3); // E5
    playNote(783.99, now + 0.16, 0.3); // G5
    playNote(1046.50, now + 0.24, 0.4); // C6
  } catch(e){}
}

// ==========================================================================
// KANBAN DRAG AND DROP HANDLERS
// ==========================================================================
function allowDrop(ev) {
  ev.preventDefault();
  const list = ev.currentTarget;
  if (list && list.classList.contains('kanban-cards-list')) {
    list.classList.add('drag-over');
  }
}

function dragLeave(ev) {
  const list = ev.currentTarget;
  if (list) {
    list.classList.remove('drag-over');
  }
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
  const list = ev.currentTarget;
  if (list) {
    list.classList.remove('drag-over');
  }

  const leadCardId = ev.dataTransfer.getData("text/plain");
  const cardElement = document.getElementById(leadCardId);
  if (!cardElement) return;

  const leadId = leadCardId.replace('kanban-card-', '');
  
  try {
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
      playSuccessChime(); // Play synthesized chime
      
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
