const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.json');

// Helper to ensure database directory and file exist
function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const defaultData = {
      agents: [
        { id: "agent_1", name: "Rahul Sharma", email: "rahul@lohithadharma.com", phone: "+91 98765 43210", status: "Active", activeLeads: 2 },
        { id: "agent_2", name: "Priya Patel", email: "priya@lohithadharma.com", phone: "+91 98765 43211", status: "Active", activeLeads: 1 },
        { id: "agent_3", name: "Amit Verma", email: "amit@lohithadharma.com", phone: "+91 98765 43212", status: "On Leave", activeLeads: 0 }
      ],
      leads: [
        {
          id: "lead_1",
          name: "Suresh Kumar",
          email: "suresh.k@gmail.com",
          phone: "+91 91234 56789",
          source: "Website Enquiry",
          budget: 4500000, // 45 Lakhs
          location: "Premium Greenfield Plots, Sector 12",
          timeline: "Within 30 Days",
          notes: "Interested in plot size 1200 sq.ft. Ready to pay booking amount this week.",
          score: 85,
          priority: "Hot",
          status: "Assigned",
          assignedAgentId: "agent_1",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "lead_2",
          name: "Anjali Rao",
          email: "anjali.rao@yahoo.com",
          phone: "+91 82345 67890",
          source: "WhatsApp Assistant",
          budget: 2800000, // 28 Lakhs
          location: "Orchard Heights, Phase 2",
          timeline: "1-3 Months",
          notes: "Enquired about payment plan. Looking for a bank loan option.",
          score: 65,
          priority: "Warm",
          status: "New",
          assignedAgentId: "agent_2",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "lead_3",
          name: "Vikram Singh",
          email: "vikram.s@outlook.com",
          phone: "+91 73456 78901",
          source: "Agent Entry Form",
          budget: 1500000, // 15 Lakhs
          location: "Green Meadows Plotting",
          timeline: "Above 3 Months",
          notes: "Just exploring investment options. Budget is low, might postpone purchase.",
          score: 30,
          priority: "Cold",
          status: "Nurturing",
          assignedAgentId: null,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      followUps: [
        {
          id: "followup_1",
          leadId: "lead_1",
          agentName: "Rahul Sharma",
          type: "Call",
          notes: "Discussed pricing and layout plan. Suresh wants to visit the site on Saturday.",
          status: "Completed",
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "followup_2",
          leadId: "lead_1",
          agentName: "Rahul Sharma",
          type: "WhatsApp",
          notes: "Shared site map PDF and brochure via WhatsApp.",
          status: "Completed",
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "followup_3",
          leadId: "lead_2",
          agentName: "Priya Patel",
          type: "Call",
          notes: "Scheduled introductory call to understand specific plot size requirement.",
          status: "Scheduled",
          date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // tomorrow
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ],
      alerts: [
        {
          id: "alert_1",
          leadId: "lead_1",
          message: "Hot Lead Suresh Kumar is assigned. Immediate site visit scheduling needed.",
          read: false,
          type: "Critical",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "alert_2",
          leadId: "lead_2",
          message: "New WhatsApp lead Anjali Rao qualified as Warm (Score 65).",
          read: false,
          type: "Info",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      chats: [
        {
          id: "chat_1",
          leadId: "lead_2",
          sender: "buyer",
          message: "Hello, I am looking for a plot near Orchard Heights.",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: "chat_2",
          leadId: "lead_2",
          sender: "bot",
          message: "Hi! I'd love to help you find the perfect plot. To guide you better, may I know your approximate budget range?",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1000).toISOString()
        },
        {
          id: "chat_3",
          leadId: "lead_2",
          sender: "buyer",
          message: "My budget is around 25 to 30 lakhs.",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 2000).toISOString()
        }
      ]
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

// Database helper functions
const db = {
  read: () => {
    initDb();
    try {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error("Failed to read database file, resetting:", err);
      // If reading fails (e.g. corruption), write empty schema
      const defaultData = { agents: [], leads: [], followUps: [], alerts: [], chats: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
  },

  write: (data) => {
    initDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  },

  leads: {
    all: () => {
      return db.read().leads || [];
    },
    find: (id) => {
      const data = db.read();
      return data.leads.find(l => l.id === id) || null;
    },
    create: (leadData) => {
      const data = db.read();
      const newLead = {
        id: 'lead_' + Math.random().toString(36).substr(2, 9),
        name: leadData.name,
        email: leadData.email || "",
        phone: leadData.phone,
        source: leadData.source || "Website Enquiry",
        budget: Number(leadData.budget) || 0,
        location: leadData.location || "General Plots",
        timeline: leadData.timeline || "Exploring",
        notes: leadData.notes || "",
        score: leadData.score || 0,
        priority: leadData.priority || "Cold",
        status: leadData.status || "New",
        assignedAgentId: leadData.assignedAgentId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.leads.push(newLead);
      db.write(data);
      return newLead;
    },
    update: (id, updateFields) => {
      const data = db.read();
      const index = data.leads.findIndex(l => l.id === id);
      if (index === -1) return null;

      data.leads[index] = {
        ...data.leads[index],
        ...updateFields,
        updatedAt: new Date().toISOString()
      };
      db.write(data);
      return data.leads[index];
    },
    delete: (id) => {
      const data = db.read();
      const initialLength = data.leads.length;
      data.leads = data.leads.filter(l => l.id !== id);
      // Clean up cascades
      data.followUps = data.followUps.filter(f => f.leadId !== id);
      data.alerts = data.alerts.filter(a => a.leadId !== id);
      data.chats = data.chats.filter(c => c.leadId !== id);
      db.write(data);
      return data.leads.length < initialLength;
    }
  },

  followUps: {
    all: () => {
      return db.read().followUps || [];
    },
    findByLead: (leadId) => {
      return db.read().followUps.filter(f => f.leadId === leadId) || [];
    },
    create: (followUpData) => {
      const data = db.read();
      const newFollowUp = {
        id: 'followup_' + Math.random().toString(36).substr(2, 9),
        leadId: followUpData.leadId,
        agentName: followUpData.agentName || "System Auto",
        type: followUpData.type || "Call", // Call, WhatsApp, Email, System alert
        notes: followUpData.notes || "",
        status: followUpData.status || "Completed", // Scheduled, Completed
        date: followUpData.date || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      data.followUps.push(newFollowUp);
      db.write(data);
      return newFollowUp;
    }
  },

  alerts: {
    all: () => {
      return db.read().alerts || [];
    },
    create: (alertData) => {
      const data = db.read();
      const newAlert = {
        id: 'alert_' + Math.random().toString(36).substr(2, 9),
        leadId: alertData.leadId,
        message: alertData.message,
        read: false,
        type: alertData.type || "Info", // Critical, Warning, Info
        createdAt: new Date().toISOString()
      };
      data.alerts.push(newAlert);
      db.write(data);
      return newAlert;
    },
    markRead: (id) => {
      const data = db.read();
      const alert = data.alerts.find(a => a.id === id);
      if (alert) {
        alert.read = true;
        db.write(data);
        return alert;
      }
      return null;
    },
    markAllRead: () => {
      const data = db.read();
      data.alerts.forEach(a => a.read = true);
      db.write(data);
      return true;
    }
  },

  agents: {
    all: () => {
      return db.read().agents || [];
    },
    find: (id) => {
      return db.read().agents.find(a => a.id === id) || null;
    },
    updateLeadsCount: (id, change) => {
      const data = db.read();
      const agent = data.agents.find(a => a.id === id);
      if (agent) {
        agent.activeLeads = Math.max(0, (agent.activeLeads || 0) + change);
        db.write(data);
        return agent;
      }
      return null;
    }
  },

  chats: {
    findByLead: (leadId) => {
      return db.read().chats.filter(c => c.leadId === leadId) || [];
    },
    create: (chatData) => {
      const data = db.read();
      const newChat = {
        id: 'chat_' + Math.random().toString(36).substr(2, 9),
        leadId: chatData.leadId,
        sender: chatData.sender, // buyer, bot, agent
        message: chatData.message,
        timestamp: new Date().toISOString()
      };
      data.chats.push(newChat);
      db.write(data);
      return newChat;
    }
  }
};

module.exports = db;
