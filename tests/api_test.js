const express = require('express');
const http = require('http');
const routes = require('../backend/routes');
const db = require('../backend/db');

// Set port to 3001 to prevent conflicts with 3000
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

// Helper function to assert expressions
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILURE: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ SUCCESS: ${message}`);
  }
}

// Delay helper
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log("======================================================");
  console.log(" RUNNING AI LEAD QUALIFICATION API INTEGRATION TESTS");
  console.log("======================================================\n");

  // Spin up test server
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  
  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}...\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Get initial dashboard stats
    // ----------------------------------------------------
    console.log("--- TEST 1: Dashboard Stats ---");
    let res = await fetch(`${BASE_URL}/dashboard/stats`);
    assert(res.ok, "Fetch dashboard stats returns 200");
    let stats = await res.json();
    assert(stats.totalLeads >= 3, "Initial database seeded with at least 3 leads");
    assert(stats.hotLeads !== undefined, "Stats contain hotLeads count");
    console.log(`Current Total Leads: ${stats.totalLeads}, Hot: ${stats.hotLeads}\n`);

    // ----------------------------------------------------
    // TEST 2: Post a highly qualified Hot Lead
    // ----------------------------------------------------
    console.log("--- TEST 2: Create Hot Lead & Verify AI Scoring ---");
    const hotLeadPayload = {
      name: "Test Hot Buyer",
      phone: "+91 99999 88888",
      email: "hot.buyer@test.com",
      budget: 6500000, // 65 Lakhs (Full score budget)
      location: "Premium Greenfield Plots, Sector 12", // Premium location
      timeline: "Within 30 Days", // Immediate purchase timeline
      notes: "Looking to book corner plot immediately. Have cash ready.",
      source: "Website Enquiry"
    };

    res = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotLeadPayload)
    });
    assert(res.status === 201, "Create lead returns status 201");
    let newLead = await res.json();
    
    // Check validation of score calculations
    // Budget >= 50L (40 pts) + Timeline Within 30 Days (30 pts) + Contacts email & phone (10 pts) + Premium location (20 pts) = 100 points
    assert(newLead.score === 100, `Lead score calculation correct. Got ${newLead.score}/100, expected 100`);
    assert(newLead.priority === 'Hot', `Lead correctly prioritized as Hot. Got: ${newLead.priority}`);
    assert(newLead.assignedAgentId !== null, `Hot lead was auto-allocated to an active agent: ${newLead.assignedAgentId}`);
    assert(newLead.aiSummary.length > 0, "AI summary text has been generated");
    assert(newLead.whatsappTemplate.length > 0, "WhatsApp follow-up templates generated");
    console.log(`Created Lead ID: ${newLead.id}, Score: ${newLead.score}, Priority: ${newLead.priority}\n`);

    // ----------------------------------------------------
    // TEST 3: Validate API filters
    // ----------------------------------------------------
    console.log("--- TEST 3: Filter & Search Lead List ---");
    res = await fetch(`${BASE_URL}/leads?priority=hot`);
    assert(res.ok, "Get leads filter priority returns 200");
    let hotLeads = await res.json();
    assert(hotLeads.some(l => l.id === newLead.id), "Filtered hot list includes our test lead");

    res = await fetch(`${BASE_URL}/leads?search=Hot%20Buyer`);
    assert(res.ok, "Search leads returns 200");
    let searchedLeads = await res.json();
    assert(searchedLeads.length > 0 && searchedLeads[0].name === "Test Hot Buyer", "Search finds the lead by name");
    console.log(`Filter and Search verified successfully.\n`);

    // ----------------------------------------------------
    // TEST 4: Log Follow-up action & transition status
    // ----------------------------------------------------
    console.log("--- TEST 4: Log Follow-up Action & Status Transition ---");
    const followupPayload = {
      agentName: "Rahul Sharma",
      type: "Call",
      notes: "Called test buyer. Confirmed site visit for tomorrow morning.",
      status: "Completed"
    };

    res = await fetch(`${BASE_URL}/leads/${newLead.id}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(followupPayload)
    });
    assert(res.status === 201, "Log follow-up returns 201");
    let logResult = await res.json();
    assert(logResult.leadId === newLead.id, "Follow-up successfully referenced to correct lead");

    // Fetch lead details again to check status updated from "Assigned" to "Contacted"
    res = await fetch(`${BASE_URL}/leads/${newLead.id}`);
    let updatedLead = await res.json();
    assert(updatedLead.status === 'Contacted', `Lead status auto-transitioned to Contacted. Got: ${updatedLead.status}`);
    assert(updatedLead.followUps.length === 1, "Follow-up history list updated in detail view");
    console.log(`Follow-up registered. Status transitioned to: ${updatedLead.status}\n`);

    // ----------------------------------------------------
    // TEST 5: WhatsApp Simulation bot auto-replies
    // ----------------------------------------------------
    console.log("--- TEST 5: Interactive Chatbot Auto-Reply Simulator ---");
    const chatPayload = {
      sender: "buyer",
      message: "Hello, looking for a plot please."
    };

    res = await fetch(`${BASE_URL}/leads/${newLead.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatPayload)
    });
    assert(res.status === 201, "Chat message posted returns 201");

    console.log("Waiting for WhatsApp bot reaction...");
    await sleep(1500); // Wait for async timer (1200ms)

    res = await fetch(`${BASE_URL}/leads/${newLead.id}/chat`);
    let chats = await res.json();
    
    // Last message should be bot reply
    let lastChat = chats[chats.length - 1];
    assert(lastChat.sender === 'bot', `Bot replied to client inquiry. Sender is: ${lastChat.sender}`);
    assert(lastChat.message.includes("budget"), "Bot asked for budget requirements");
    console.log(`Bot Response: "${lastChat.message}"\n`);

    console.log("======================================================");
    console.log(" 🎉 ALL API TEST CASES PASSED SUCCESSFULLY!");
    console.log("======================================================");

  } catch (err) {
    console.error("\n❌ TESTS FAILED!");
    console.error(err);
    process.exitCode = 1;
  } finally {
    // Shutdown server
    if (server) {
      server.close();
      console.log("\nTest server shut down.");
    }
  }
}

// Execute tests
runTests();
