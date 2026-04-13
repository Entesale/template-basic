---
name: entesale-crm
description: Always import then interacting with external contacts, companies or proceed with an action in deals. 
---

# CRM Database Schema

This database contains the full CRM for one organization. There is NO organization_id column — isolation is enforced at the database level.

## Tables

### Tag
| Column     | Type      | Notes                  |
|------------|-----------|------------------------|
| id         | uuid PK   | gen_random_uuid()      |
| name       | text      | Required               |
| color      | text      | Required (hex or name) |
| createdAt  | timestamp | DEFAULT now()          |

### Company
| Column         | Type      | Notes                              |
|----------------|-----------|------------------------------------|
| id             | uuid PK   |                                    |
| name           | text      | Required                           |
| sector         | text      | Industry (e.g. "SaaS", "Finance")  |
| size           | smallint  | Headcount bucket (e.g. 1=1-10)     |
| revenue        | text      | Free text (e.g. "$1M–$10M")        |
| website        | text      |                                    |
| linkedinUrl    | text      |                                    |
| phoneNumber    | text      |                                    |
| address        | text      |                                    |
| city           | text      |                                    |
| stateAbbr      | text      |                                    |
| zipcode        | text      |                                    |
| country        | text      |                                    |
| description    | text      | Free notes                         |
| taxIdentifier  | text      |                                    |
| logo           | jsonb     | { src: string, title: string }     |
| contextLinks   | jsonb     | Array of { url, label }            |
| createdAt      | timestamp | DEFAULT now()                      |

### Contact
| Column        | Type      | Notes                                         |
|---------------|-----------|-----------------------------------------------|
| id            | uuid PK   |                                               |
| companyId     | uuid FK   | References Company(id), nullable              |
| agentId       | uuid      | Owning agent (no FK — references main DB)     |
| firstName     | text      |                                               |
| lastName      | text      |                                               |
| gender        | text      |                                               |
| title         | text      | Job title                                     |
| background    | text      | Free notes about the person                   |
| status        | text      | e.g. "hot lead", "customer", "churned"        |
| tags          | text[]    | Array of tag names                            |
| avatar        | jsonb     | { src, title }                                |
| linkedinUrl   | text      |                                               |
| email         | jsonb     | Array of { email, type } (type: work/personal)|
| phone         | jsonb     | Array of { number, type }                     |
| hasNewsletter | boolean   |                                               |
| firstSeen     | timestamp | First time this person was encountered        |
| lastSeen      | timestamp | ALWAYS update when you interact with them     |
| createdAt     | timestamp | DEFAULT now()                                 |

### Deal
| Column              | Type      | Notes                                        |
|---------------------|-----------|----------------------------------------------|
| id                  | uuid PK   |                                              |
| companyId           | uuid FK   | References Company(id), nullable             |
| contactIds          | uuid[]    | Array of Contact ids involved                |
| agentId             | uuid      | Owning agent (no FK)                         |
| name                | text      | Required — deal name/title                   |
| stage               | text      | FREE TEXT — any value is valid. Examples:    |
|                     |           |   "Lead", "Qualified", "Proposal",           |
|                     |           |   "Negotiation", "Won", "Lost"               |
|                     |           | Kanban groups by distinct stage values.      |
| category            | text      | Deal category/type                           |
| amount              | bigint    | Amount in CENTS (e.g. $1000 = 100000)        |
| description         | text      |                                              |
| index               | smallint  | Kanban ordering within stage column          |
| expectedClosingDate | date      | ISO date (YYYY-MM-DD)                        |
| archivedAt          | timestamp | Set to archive; null = active                |
| createdAt           | timestamp | DEFAULT now()                                |
| updatedAt           | timestamp | DEFAULT now(); update on every change        |

### ContactNote
| Column      | Type      | Notes                                          |
|-------------|-----------|------------------------------------------------|
| id          | uuid PK   |                                                |
| contactId   | uuid FK   | References Contact(id), required               |
| agentId     | uuid      | Agent who logged the note (no FK)              |
| text        | text      | Note content                                   |
| status      | text      | e.g. "completed", "pending"                    |
| attachments | text[]    | Array of file URLs or paths                    |
| date        | timestamp | DEFAULT now()                                  |

### DealNote
| Column      | Type      | Notes                                          |
|-------------|-----------|------------------------------------------------|
| id          | uuid PK   |                                                |
| dealId      | uuid FK   | References Deal(id), required                  |
| agentId     | uuid      | Agent who logged the note (no FK)              |
| type        | text      | Interaction type. Values:                      |
|             |           |   "call" — phone/video call                    |
|             |           |   "email" — email exchange                     |
|             |           |   "meeting" — in-person or virtual meeting     |
|             |           |   "note" — general note                        |
|             |           |   "demo" — product demo                        |
|             |           |   "proposal" — sent a proposal                 |
| text        | text      | Note content                                   |
| attachments | text[]    | Array of file URLs or paths                    |
| date        | timestamp | DEFAULT now()                                  |

### Task
| Column    | Type      | Notes                                                    |
|-----------|-----------|----------------------------------------------------------|
| id        | uuid PK   |                                                          |
| contactId | uuid FK   | References Contact(id), nullable                         |
| dealId    | uuid FK   | References Deal(id), nullable                            |
| agentId   | uuid      | Responsible agent (no FK)                                |
| type      | text      | Task type. Values:                                       |
|           |           |   "follow_up" — check in with contact                    |
|           |           |   "call" — scheduled call                                |
|           |           |   "email" — send email                                   |
|           |           |   "meeting" — schedule/attend meeting                    |
|           |           |   "demo" — run a demo                                    |
|           |           |   "proposal" — prepare/send proposal                    |
| text      | text      | Required — description of what to do                     |
| dueDate   | timestamp | DEADLINE — must be done by this time                     |
| doDate    | timestamp | SCHEDULED — when you plan to actually do it              |
|           |           | Heartbeat checks doDate <= now() to find pending work    |
| doneDate  | timestamp | Set when task is completed; null = open                  |
| createdAt | timestamp | DEFAULT now()                                            |

## Common Queries

### Check pending tasks for your agent
```sql
SELECT t.*, c."firstName", c."lastName", d.name as "dealName"
FROM "Task" t
LEFT JOIN "Contact" c ON t."contactId" = c.id
LEFT JOIN "Deal" d ON t."dealId" = d.id
WHERE t."agentId" = $1
  AND t."doneDate" IS NULL
  AND t."doDate" <= now()
ORDER BY t."doDate" ASC;
```

### Create a contact
```sql
INSERT INTO "Contact" ("agentId", "firstName", "lastName", "status", "lastSeen", "firstSeen")
VALUES ($1, $2, $3, $4, now(), now())
RETURNING id;
```

### Update lastSeen
```sql
UPDATE "Contact" SET "lastSeen" = now() WHERE id = $1;
```

### Create a deal
```sql
INSERT INTO "Deal" ("agentId", "name", "stage", "companyId", "contactIds", "amount")
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;
```

### Move a deal to a new stage
```sql
UPDATE "Deal" SET "stage" = $1, "updatedAt" = now() WHERE id = $2;
```

### Log a contact interaction
```sql
INSERT INTO "ContactNote" ("contactId", "agentId", "text", "status")
VALUES ($1, $2, $3, 'completed');
```

### Complete a task
```sql
UPDATE "Task" SET "doneDate" = now() WHERE id = $1;
```

### Get active deals by stage (for kanban)
```sql
SELECT stage, COUNT(*) as count, SUM(amount) as "totalAmount"
FROM "Deal"
WHERE "archivedAt" IS NULL
GROUP BY stage
ORDER BY MIN(index) ASC;
```

## Common Operations

**Find or create a company:**
```sql
SELECT * FROM companies WHERE domain = 'example.com' LIMIT 1;
INSERT INTO companies (name, domain) VALUES ('Example Co', 'example.com') RETURNING *;
```

**Find or create a contact:**
```sql
SELECT * FROM contacts WHERE email = 'jane@example.com' LIMIT 1;
INSERT INTO contacts (name, email, title, company_id)
  VALUES ('Jane Smith', 'jane@example.com', 'VP Sales', <company_id>) RETURNING *;
```

**Log an activity:**
```sql
INSERT INTO activities (contact_id, type, content)
  VALUES (<id>, 'outreach', 'Sent intro message via Telegram') RETURNING *;
```

**Update a deal stage:**
```sql
UPDATE deals SET stage = 'interested' WHERE id = <id>;
```
