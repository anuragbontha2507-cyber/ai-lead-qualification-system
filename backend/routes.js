const express = require('express');
const router = express.Router();
const db = require('./db');
const { processLeadQualification } = require('./ai_service');

// 1. GET Dashboard Stats
router.get('/dashboard/stats', (req, res) => {
  try {
    const leads = db.leads.all();
    const alerts = db.alerts.all();
    const followUps = db.followUps.all();
    
    const totalLeads = leads.length;
    const hotLeads = leads.filter(l => l.priority === 'Hot').length;
    const warmLeads = leads.filter(l => l.priority === 'Warm').length;
    const coldLeads = leads.filter(l => l.priority === 'Cold').length;
    
    const unreadAlerts = alerts.filter(a => !a.read).length;
    const pendingFollowups = followUps.filter(f => f.status === 'Scheduled').length;
    
    // Calculate estimated pipeline value (sum of budgets for Hot/Warm leads)
    const pipelineValue = leads
      .filter(l => l.priority === 'Hot' || l.priority === 'Warm')
      .reduce((sum, l) => sum + (l.budget || 0), 0);

    // Budget range distribution
    const distribution = {
      under10L: leads.filter(l => l.budget < 1000000).length,
      between10_25L: leads.filter(l => l.budget >= 1000000 && l.budget < 2500000).length,
      between25_50L: leads.filter(l => l.budget >= 2500000 && l.budget < 5000000).length,
      above50L: leads.filter(l => l.budget >= 5000000).length
    };

    res.json({
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      unreadAlerts,
      pendingFollowups,
      pipelineValue,
      budgetDistribution: distribution
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard statistics", details: err.message });
  }
});

// 2. GET Leads List (with filtering and search)
router.get('/leads', (req, res) => {
  try {
    let leads = db.leads.all();
    const { priority, status, search } = req.query;

    if (priority) {
      leads = leads.filter(l => l.priority.toLowerCase() === priority.toLowerCase());
    }

    if (status) {
      leads = leads.filter(l => l.status.toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l => 
        l.name.toLowerCase().includes(q) || 
        l.location.toLowerCase().includes(q) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        l.phone.includes(q)
      );
    }

    // Sort: newest first
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: "Failed to list leads", details: err.message });
  }
});

// 3. GET Lead Detail
router.get('/leads/:id', (req, res) => {
  try {
    const lead = db.leads.find(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const followUps = db.followUps.findByLead(lead.id);
    const chats = db.chats.findByLead(lead.id);
    const agents = db.agents.all();
    const assignedAgent = lead.assignedAgentId ? db.agents.find(lead.assignedAgentId) : null;

    res.json({
      ...lead,
      followUps,
      chats,
      assignedAgent,
      availableAgents: agents
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve lead details", details: err.message });
  }
});

// 3.5 PATCH Update Lead Details
router.patch('/leads/:id', async (req, res) => {
  try {
    const lead = db.leads.find(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Update values
    db.leads.update(req.params.id, req.body);
    
    // If scoring fields are updated, re-process qualification
    if (req.body.budget !== undefined || req.body.location !== undefined || 
        req.body.timeline !== undefined || req.body.phone !== undefined || 
        req.body.email !== undefined) {
      await processLeadQualification(lead.id);
    }

    const finalLead = db.leads.find(req.params.id);
    res.json(finalLead);
  } catch (err) {
    res.status(500).json({ error: "Failed to update lead details", details: err.message });
  }
});

// 4. POST Create Lead
router.post('/leads', async (req, res) => {
  try {
    const { name, phone, email, budget, location, timeline, notes, source } = req.body;

    // Validate request
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and Phone number are required fields." });
    }

    const newLead = db.leads.create({
      name,
      phone,
      email,
      budget: Number(budget) || 0,
      location: location || "General Plots",
      timeline: timeline || "Exploring",
      notes: notes || "",
      source: source || "Agent Entry Form"
    });

    // Run AI Lead Qualification immediately
    const qualifiedLead = await processLeadQualification(newLead.id);

    res.status(201).json(qualifiedLead);
  } catch (err) {
    res.status(500).json({ error: "Failed to create lead", details: err.message });
  }
});

// 5. POST Re-evaluate/Process Lead AI
router.post('/leads/:id/process', async (req, res) => {
  try {
    const lead = db.leads.find(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const qualifiedLead = await processLeadQualification(lead.id);
    res.json(qualifiedLead);
  } catch (err) {
    res.status(500).json({ error: "Failed to process lead qualification", details: err.message });
  }
});

// 6. POST Log Follow-up Action
router.post('/leads/:id/followup', (req, res) => {
  try {
    const lead = db.leads.find(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const { agentName, type, notes, status, date } = req.body;
    if (!notes || !type) {
      return res.status(400).json({ error: "Type and Notes are required for follow-up" });
    }

    const newFollowUp = db.followUps.create({
      leadId: lead.id,
      agentName: agentName || "System Auto",
      type, // Call, WhatsApp, Email, System alert
      notes,
      status: status || "Completed", // Scheduled, Completed
      date: date || new Date().toISOString()
    });

    // Automatically transition lead status based on actions
    let newStatus = lead.status;
    if (newStatus === 'New' || newStatus === 'Assigned') {
      newStatus = 'Contacted';
    }
    
    db.leads.update(lead.id, { status: newStatus });

    res.status(201).json(newFollowUp);
  } catch (err) {
    res.status(500).json({ error: "Failed to log follow-up action", details: err.message });
  }
});

// 7. POST Assign Agent
router.post('/leads/:id/assign', (req, res) => {
  try {
    const lead = db.leads.find(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const { agentId } = req.body;
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required for assignment" });
    }

    const agent = db.agents.find(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Decrement previous agent's active lead count if any
    if (lead.assignedAgentId) {
      db.agents.updateLeadsCount(lead.assignedAgentId, -1);
    }

    // Assign new agent
    db.agents.updateLeadsCount(agentId, 1);
    const updatedLead = db.leads.update(lead.id, {
      assignedAgentId: agentId,
      status: lead.status === 'New' ? 'Assigned' : lead.status
    });

    // Add system followup log
    db.followUps.create({
      leadId: lead.id,
      agentName: "System",
      type: "System alert",
      notes: `Lead assigned to sales agent: ${agent.name}`,
      status: "Completed"
    });

    res.json(updatedLead);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign agent", details: err.message });
  }
});

// 8. GET Agents
router.get('/agents', (req, res) => {
  try {
    res.json(db.agents.all());
  } catch (err) {
    res.status(500).json({ error: "Failed to load agents", details: err.message });
  }
});

// 9. GET Active Alerts
router.get('/alerts', (req, res) => {
  try {
    const alerts = db.alerts.all();
    // Return unread alerts first, sorted by newest
    const sortedAlerts = alerts.sort((a, b) => {
      if (a.read === b.read) return new Date(b.createdAt) - new Date(a.createdAt);
      return a.read ? 1 : -1;
    });
    res.json(sortedAlerts);
  } catch (err) {
    res.status(500).json({ error: "Failed to list alerts", details: err.message });
  }
});

// 10. POST Mark Alerts Read
router.post('/alerts/read', (req, res) => {
  try {
    db.alerts.markAllRead();
    res.json({ success: true, message: "All alerts marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to read alerts", details: err.message });
  }
});

// 11. POST Chat message (WhatsApp simulator)
router.post('/leads/:id/chat', async (req, res) => {
  try {
    const lead = db.leads.find(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const { sender, message } = req.body;
    if (!message || !sender) {
      return res.status(400).json({ error: "Sender and message are required" });
    }

    // Save message
    const userChat = db.chats.create({
      leadId: lead.id,
      sender,
      message
    });

    // If sender is buyer, trigger automated conversational bot reply
    if (sender === 'buyer') {
      setTimeout(async () => {
        let replyMsg = "";
        const msg = message.toLowerCase();
        
        // Simple contextual chat flows matching real estate enquiry
        if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
          replyMsg = `Hi ${lead.name}! Thanks for reaching out. What is your expected budget range for a residential plot?`;
        } else if (msg.includes('lakh') || msg.includes('crore') || msg.includes('budget') || msg.match(/\d+/)) {
          // Parse budget if mentioned
          const numbers = msg.match(/\d+/g);
          if (numbers && numbers.length > 0) {
            const parsedBudget = parseInt(numbers[0]) * (msg.includes('lakh') ? 100000 : msg.includes('crore') ? 10000000 : 1);
            db.leads.update(lead.id, { budget: parsedBudget });
            replyMsg = `Thank you! I've updated your budget preference to ₹${(parsedBudget/100000).toFixed(1)} Lakhs. In which location/project layout are you interested?`;
          } else {
            replyMsg = "Got it. Could you please specify your budget range in Lakhs (e.g. 25 Lakhs) so we can match you with suitable options?";
          }
        } else if (msg.includes('location') || msg.includes('sector') || msg.includes('phase') || msg.includes('orchard') || msg.includes('greenfield')) {
          replyMsg = "Excellent project choice! Real estate appreciation in this area is solid. Lastly, when are you planning to invest? (e.g. Within 30 days, 3 months, or just exploring?)";
        } else if (msg.includes('days') || msg.includes('month') || msg.includes('year') || msg.includes('immediate') || msg.includes('exploring')) {
          replyMsg = "Perfect! I have recorded your preferences. One of our sales experts will contact you directly on this number to arrange a site visit. Let us know if you need anything else!";
          // Update timeline based on text
          let timelineVal = "1-3 Months";
          if (msg.includes('30 days') || msg.includes('immediate')) timelineVal = "Within 30 Days";
          if (msg.includes('exploring')) timelineVal = "Above 3 Months";
          db.leads.update(lead.id, { timeline: timelineVal });
        } else {
          replyMsg = "Thank you. Your details are captured in our system. An agent from Lohithadharma Projects will call you shortly to discuss further details.";
        }

        // Save bot response
        db.chats.create({
          leadId: lead.id,
          sender: 'bot',
          message: replyMsg
        });

        // Trigger AI Re-qualification to score new inputs captured in chat
        await processLeadQualification(lead.id);

      }, 1200); // simulate typings
    }

    res.status(201).json(userChat);
  } catch (err) {
    res.status(500).json({ error: "Failed to post chat message", details: err.message });
  }
});

// 12. GET Chat History
router.get('/leads/:id/chat', (req, res) => {
  try {
    const chats = db.chats.findByLead(req.params.id);
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Failed to load chat history", details: err.message });
  }
});

module.exports = router;
