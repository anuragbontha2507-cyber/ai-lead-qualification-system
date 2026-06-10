const db = require('./db');

// Basic regex for email validation
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Basic phone validation (check for length and digits)
function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

/**
 * Score the lead based on budget, timeline, location interest, and contact completeness.
 * Total possible: 100 points
 */
function calculateLeadScore(lead) {
  let score = 0;

  // 1. Budget Relevance (Max 40 points)
  const budget = Number(lead.budget) || 0;
  if (budget >= 5000000) {
    score += 40; // 50+ Lakhs
  } else if (budget >= 2500000) {
    score += 30; // 25 - 50 Lakhs
  } else if (budget >= 1000000) {
    score += 15; // 10 - 25 Lakhs
  } else if (budget > 0) {
    score += 5;  // < 10 Lakhs
  }

  // 2. Timeline (Max 30 points)
  const timeline = String(lead.timeline).toLowerCase();
  if (timeline.includes('30 days') || timeline.includes('immediate') || timeline.includes('now')) {
    score += 30;
  } else if (timeline.includes('1-3 months') || timeline.includes('soon')) {
    score += 20;
  } else if (timeline.includes('3-6 months')) {
    score += 10;
  } else {
    score += 5; // Long term or exploring
  }

  // 3. Contact Details (Max 10 points)
  if (lead.email && isValidEmail(lead.email)) {
    score += 5;
  }
  if (lead.phone && isValidPhone(lead.phone)) {
    score += 5;
  }

  // 4. Location Interest (Max 20 points)
  const location = String(lead.location).toLowerCase();
  if (location.trim().length > 3) {
    // Specific premium locations get extra weight
    if (location.includes('sector 12') || location.includes('greenfield') || location.includes('orchard')) {
      score += 20;
    } else {
      score += 10;
    }
  }

  return score;
}

/**
 * Fallback local text generation engine to generate summaries and templates
 */
function generateLocalAIOutput(lead, score, priority, agentName) {
  const budgetInLakhs = (lead.budget / 100000).toFixed(1);
  const location = lead.location || "our layouts";
  
  // AI summary
  let summary = "";
  let suggestedAction = "";
  if (priority === "Hot") {
    summary = `Lead is highly qualified with an immediate timeline (${lead.timeline}) and a strong budget of ${budgetInLakhs} Lakhs. They expressed explicit interest in ${location} and left active notes: "${lead.notes}".`;
    suggestedAction = `Call ${lead.name} immediately. Introduce yourself as representative of lohithadharma Projects. Schedule a site visit for this upcoming weekend.`;
  } else if (priority === "Warm") {
    summary = `Lead shows solid interest with moderate budget (${budgetInLakhs} Lakhs) and mid-term timeline (${lead.timeline}) for ${location}. Contact details are verified.`;
    suggestedAction = `Send a follow-up brochure via WhatsApp and follow up with a phone call within 24 hours to clarify plot size preferences.`;
  } else {
    summary = `Lead is low priority. Budget of ${budgetInLakhs} Lakhs is below our premium threshold, and timeline is long-term. Currently marked as cold/exploring.`;
    suggestedAction = `Add to monthly email marketing newsletter. Check back in 3 months if requirements update.`;
  }

  // WhatsApp template
  const whatsapp = `Hi ${lead.name}, thank you for your enquiry with lohithadharma Projects. I see you're interested in plots at ${location} (budget: ₹${budgetInLakhs} L). I am ${agentName}, your dedicated advisor. Would you be available for a brief call or a site visit this week? - Regards, ${agentName}`;

  // Email template
  const emailSubject = `Enquiry: Premium Plots at ${location} - lohithadharma Projects`;
  const emailBody = `Dear ${lead.name},

Thank you for contacting lohithadharma Projects PVT, LTD.

We received your request regarding plotting options in "${location}". 
We note your preferences:
- Budget Profile: ₹${budgetInLakhs} Lakhs
- Expected Investment Timeline: ${lead.timeline}

We have premium layout packages matching your requirements. I would like to schedule a quick call to share layout drawings, pricing details, and set up a site visit.

Please let me know a suitable time to call you, or contact me directly at your convenience.

Warm regards,
${agentName}
Sales Representative
lohithadharma Projects PVT, LTD.`;

  return {
    summary,
    suggestedAction,
    templates: {
      whatsapp,
      email: {
        subject: emailSubject,
        body: emailBody
      }
    }
  };
}

/**
 * Call the real Gemini API if GEMINI_API_KEY is available
 */
async function generateGeminiAIOutput(lead, score, priority, agentName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `
You are the AI Sales Copilot for a premium Indian real estate plotting company "lohithadharma Projects PVT, LTD.".
Analyze this captured customer lead:
- Name: ${lead.name}
- Email: ${lead.email}
- Phone: ${lead.phone}
- Budget: ${lead.budget} INR (which is ${(lead.budget / 100000).toFixed(1)} Lakhs)
- Location Interest: ${lead.location}
- Investment Timeline: ${lead.timeline}
- Customer Notes: ${lead.notes}
- Qualification Score: ${score}/100
- Priority Category: ${priority}
- Assigned Agent: ${agentName}

Task:
Generate a JSON output with the following keys:
1. "summary": A professional sales summary of this lead's readiness, intent, and value (2-3 sentences).
2. "suggestedAction": The next critical operational action the agent should take.
3. "whatsapp": A warm, personalized WhatsApp message template to send to the buyer, mentioning their specific location and budget, signed by "${agentName} from lohithadharma Projects". Keep it concise and action-oriented.
4. "emailSubject": A compelling email subject line.
5. "emailBody": A formal, welcoming email draft containing key proposal highlights, thanking them, and offering a site visit. Signed by "${agentName}, lohithadharma Projects PVT, LTD."

Return ONLY valid JSON. No markdown wrappers (like \`\`\`json), no trailing commas, no extra text.
`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = JSON.parse(text);

    return {
      summary: result.summary,
      suggestedAction: result.suggestedAction,
      templates: {
        whatsapp: result.whatsapp,
        email: {
          subject: result.emailSubject,
          body: result.emailBody
        }
      }
    };
  } catch (err) {
    console.warn("Gemini API call failed, using local rule-based generation:", err.message);
    return generateLocalAIOutput(lead, score, priority, agentName);
  }
}

/**
 * Process lead qualification
 * Calculates score, assigns agent, writes AI outputs
 */
async function processLeadQualification(leadId) {
  const lead = db.leads.find(leadId);
  if (!lead) return null;

  // Calculate score
  const score = calculateLeadScore(lead);
  
  // Classify priority
  let priority = "Cold";
  if (score >= 75) {
    priority = "Hot";
  } else if (score >= 40) {
    priority = "Warm";
  }

  // Get or assign agent
  let assignedAgentId = lead.assignedAgentId;
  const agents = db.agents.all();
  
  // If not assigned and is Hot or Warm, assign to agent with lowest active load
  if (!assignedAgentId && (priority === "Hot" || priority === "Warm")) {
    const activeAgents = agents.filter(a => a.status === "Active");
    if (activeAgents.length > 0) {
      activeAgents.sort((a, b) => (a.activeLeads || 0) - (b.activeLeads || 0));
      assignedAgentId = activeAgents[0].id;
      db.agents.updateLeadsCount(assignedAgentId, 1);
    }
  }

  const assignedAgent = assignedAgentId ? db.agents.find(assignedAgentId) : null;
  const agentName = assignedAgent ? assignedAgent.name : "Sales Representative";

  // Generate AI Summaries and Templates (Check for env API key)
  const apiKey = process.env.GEMINI_API_KEY;
  let aiOutput;
  if (apiKey) {
    aiOutput = await generateGeminiAIOutput(lead, score, priority, agentName, apiKey);
  } else {
    aiOutput = generateLocalAIOutput(lead, score, priority, agentName);
  }

  // Update lead with scored parameters and auto status
  let updatedStatus = lead.status;
  if (lead.status === "New" && assignedAgentId) {
    updatedStatus = "Assigned";
  }

  const updatedLead = db.leads.update(leadId, {
    score,
    priority,
    assignedAgentId,
    status: updatedStatus,
    aiSummary: aiOutput.summary,
    aiSuggestedAction: aiOutput.suggestedAction,
    whatsappTemplate: aiOutput.templates.whatsapp,
    emailSubject: aiOutput.templates.email.subject,
    emailBody: aiOutput.templates.email.body
  });

  // Generate notifications/alerts
  if (priority === "Hot") {
    db.alerts.create({
      leadId: lead.id,
      message: `CRITICAL ALERT: Hot Lead "${lead.name}" (Score ${score}) captured. Needs instant follow-up!`,
      type: "Critical"
    });
  } else if (priority === "Warm" && lead.priority !== "Warm") {
    db.alerts.create({
      leadId: lead.id,
      message: `Lead "${lead.name}" qualified as Warm. Follow-up scheduled with ${agentName}.`,
      type: "Info"
    });
  }

  return updatedLead;
}

module.exports = {
  calculateLeadScore,
  processLeadQualification,
  generateLocalAIOutput
};
