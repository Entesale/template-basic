# CRM Skill

Use the CRM MCP tools to manage contacts, companies, deals, and activities.

## Key Tables
- `contacts`: Individual people (name, email, phone, title, company_id)
- `companies`: Organizations (name, domain, industry, size)
- `deals`: Sales opportunities (contact_id, stage, value, notes)
- `activities`: Logged actions (contact_id, type, content, created_at)

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
