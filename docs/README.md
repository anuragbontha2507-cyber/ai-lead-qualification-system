# AI Lead Qualification & Follow-up System
### Real Estate Prototype for lohithadharma Projects PVT, LTD.

This repository implements the working prototype for the **AI Lead Qualification + Follow-up System** developed during the internship duration (01 June 2026 - 30 June 2026) for lohithadharma Projects PVT, LTD.

---

## 1. Project Abstract
Real estate operations depend heavily on fast customer follow-ups. Delays in responding to priority buyers lead to wasted team resources and missed revenue. The **AI Lead Qualification + Follow-up System** is a full-stack digital solution that auto-captures enquiries from multiple channels (website/app/WhatsApp simulation), score-rates them based on budget/timeline/location, auto-assigns qualified hot leads to active sales representatives, and equips agents with instant AI-generated WhatsApp and Email copy-paste templates to close deals rapidly.

---

## 2. Technology Stack
- **Frontend Layer**: Vanilla HTML5, CSS3 (Modern dark-mode glassmorphic theme), JavaScript (ES6 Modules)
- **Backend API Layer**: Node.js, Express Framework
- **AI Core Engine**: Rule-Based Prompt Scoring with Google Gemini API integration (built-in fallback engine)
- **Database Engine**: Local Relational JSON file database (`data/database.json`) for zero-setup execution
- **API Validation**: Integrated Test Runner (`tests/api_test.js`)

---

## 3. Database Schema Overview
The relational database system stores data inside `data/database.json`. The tables mapped are:
1. **leads**:
   - `id`: String (Primary Key)
   - `name`, `phone`, `email`, `source`
   - `budget` (Number), `location`, `timeline`
   - `score` (0-100), `priority` (Hot / Warm / Cold), `status` (New / Assigned / Contacted / Nurturing / Converted / Lost)
   - `assignedAgentId` (Foreign Key referencing agents.id)
   - `aiSummary`, `aiSuggestedAction`, `whatsappTemplate`, `emailSubject`, `emailBody`
2. **followUps**:
   - `id` (Primary Key)
   - `leadId` (Foreign Key referencing leads.id)
   - `agentName`, `type` (Call, WhatsApp, Email, Site Visit, System alert), `notes`, `status` (Scheduled, Completed), `date`
3. **alerts**:
   - `id` (Primary Key)
   - `leadId`, `message`, `read` (Boolean), `type` (Critical, Info), `createdAt`
4. **agents**:
   - `id` (Primary Key)
   - `name`, `email`, `phone`, `status` (Active, On Leave), `activeLeads` (Number)
5. **chats**:
   - `id` (Primary Key)
   - `leadId` (Foreign Key referencing leads.id)
   - `sender` (buyer / bot / agent), `message`, `timestamp`

---

## 4. Lead Scoring Rules
Scoring is calculated on a 100-point scale:
- **Budget Relevance** (Max 40 points):
  - Budget >= 50 Lakhs: 40 points
  - Budget 25 - 50 Lakhs: 30 points
  - Budget 10 - 25 Lakhs: 15 points
  - Budget < 10 Lakhs: 5 points
- **Investment Timeline** (Max 30 points):
  - Immediate (Within 30 Days): 30 points
  - Short-Term (1-3 Months): 20 points
  - Medium-Term (3-6 Months): 10 points
  - Long-Term / Exploring: 5 points
- **Contact Completeness** (Max 10 points):
  - Email verified: 5 points
  - Phone verified: 5 points
- **Location Interest** (Max 20 points):
  - Target layouts (Sector 12, Greenfield, Orchard): 20 points
  - General Layouts: 10 points
  - None: 0 points

### Priority Classification:
- **🔥 Hot Leads** (Score >= 75): Instant system notifications generated, auto-assignment to active agent.
- **⚡ Warm Leads** (Score 40-74): Task log created, agent follow-up scheduled.
- **❄️ Cold Leads** (Score < 40): Added to monthly marketing queue.

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js installed (v18.0.0 or higher recommended)
- npm package manager

### Installation
1. Clone or open the project folder in your terminal.
2. Install the required dependencies:
   ```bash
   npm install
   ```

### Run the Server
Start the Express server locally:
```bash
npm run dev
```
Open your web browser and navigate to:
**`http://localhost:3000`**

### Running Automated Integration Tests
You can run the full API validation test suite using:
```bash
node tests/api_test.js
```

### Config Gemini API Key (Optional)
To enable real Gemini generative AI analysis instead of local templated responses, create a `.env` file at the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```
The server will automatically read the API key and query the actual `gemini-1.5-flash` model.
