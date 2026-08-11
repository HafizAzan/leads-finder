I now want to convert my existing frontend-only mock lead generation application into a real backend-powered application.

IMPORTANT:

Do NOT redesign my UI.

Do NOT replace my existing components.

Do NOT change the existing visual theme.

Keep the current frontend workflow and connect it to a real backend.

Tech stack:

- Next.js App Router

- React

- TypeScript

- Tailwind CSS

- Firebase

- Firebase Firestore

- Firebase Admin SDK

- OpenAI API

Use clean, simple, production-ready architecture.

==================================================

1. BACKEND ARCHITECTURE

==================================================

Use this architecture:

Frontend

    ↓

Next.js Server API / Route Handlers

    ↓

Service Layer

    ↓

Firebase Admin SDK

    ↓

Firestore

For AI:

Frontend

    ↓

Next.js API

    ↓

OpenAI API

    ↓

Firestore

Never expose:

OPENAI_API_KEY

FIREBASE_ADMIN_PRIVATE_KEY

FIREBASE_ADMIN_CLIENT_EMAIL

to the browser.

All secrets must remain server-side in environment variables.

==================================================

2. FIREBASE SETUP

==================================================

Use Firebase Firestore as the primary database.

Use Firebase Admin SDK on the server.

Create a reusable Firebase Admin initialization file.

Do not initialize Firebase Admin repeatedly.

Example architecture:

lib/

  firebase/

    admin.ts

    firestore.ts

services/

  leads.service.ts

  ai.service.ts

  email.service.ts

  settings.service.ts

app/

  api/

    leads/

    ai/

    email/

    settings/

Keep responsibilities separated.

==================================================

3. FIRESTORE COLLECTIONS

==================================================

Keep the database simple.

Use these main collections:

users

leads

settings

emailQueue

Do not create unnecessary collections.

==================================================

4. USERS

==================================================

Create:

users/{userId}

Fields:

{

  id: string,

  email: string,

  name?: string,

  createdAt: Timestamp,

  updatedAt: Timestamp

}

For now, structure the code so Firebase Authentication can be connected cleanly.

Do not build a complicated authentication system yet.

==================================================

5. SETTINGS COLLECTION

==================================================

Use:

settings/{userId}

Fields:

{

  emailProvider: "gmail" | "smtp",

  emailAddress: string,

  emailConnected: boolean,

  minDelay: number,

  maxDelay: number,

  createdAt: Timestamp,

  updatedAt: Timestamp

}

The settings page must read/write this document.

Default:

minDelay = 10

maxDelay = 90

Validate:

minDelay >= 0

maxDelay >= minDelay

==================================================

6. LEADS COLLECTION

==================================================

Use:

leads/{leadId}

Fields:

{

  userId: string,

  businessName: string,

  category: string,

  city: string,

  country: string,

  description?: string,

  email?: string,

  phone?: string,

  website?: string,

  address?: string,

  contactChannel: "email" | "phone" | "none",

  source: "google_maps" | "manual" | "import",

  aiReview: {

    status: "pending" | "approved" | "warning",

    issues: string[],

    reviewedAt?: Timestamp

  },

  outreach: {

    channel: "email" | "phone",

    subject?: string,

    body?: string,

    status:

      | "not_generated"

      | "generated"

      | "ready"

      | "queued"

      | "sending"

      | "sent"

      | "failed"

      | "skipped",

    approval: "pending" | "approved",

    sendStatus:

      | "not_sent"

      | "queued"

      | "sending"

      | "sent"

      | "failed"

      | "skipped",

    generatedAt?: Timestamp,

    approvedAt?: Timestamp,

    sentAt?: Timestamp

  },

  createdAt: Timestamp,

  updatedAt: Timestamp

}

Keep all timestamps as Firebase server timestamps.

==================================================

7. EMAIL QUEUE COLLECTION

==================================================

Use:

emailQueue/{queueId}

Fields:

{

  userId: string,

  leadId: string,

  email: string,

  subject: string,

  body: string,

  status:

    | "queued"

    | "sending"

    | "sent"

    | "failed"

    | "cancelled",

  scheduledAt?: Timestamp,

  sentAt?: Timestamp,

  delaySeconds: number,

  createdAt: Timestamp,

  updatedAt: Timestamp

}

Do not actually send emails yet unless an email provider has been configured.

Keep the email sending service isolated so it can later support Gmail/SMTP.

==================================================

8. LEAD CRUD API

==================================================

Create server API routes for:

GET /api/leads

POST /api/leads

PATCH /api/leads/:id

DELETE /api/leads/:id

Also create bulk delete:

POST /api/leads/bulk-delete

Request:

{

  ids: string[]

}

Delete only leads belonging to the authenticated/current user.

Do not allow deleting another user's leads.

==================================================

9. LEAD GENERATION

==================================================

Create:

POST /api/leads/generate

Input:

{

  category: string,

  city: string,

  country: string,

  limit: number,

  description?: string

}

The frontend should send these values.

IMPORTANT:

Do NOT pretend that OpenAI can directly search Google Maps.

Create a separate service abstraction:

businessDiscoveryService

Example:

services/

  business-discovery.service.ts

Interface:

discoverBusinesses({

  category,

  city,

  country,

  limit,

  description

})

For now, keep the provider implementation isolated.

Create:

GoogleMapsBusinessDiscoveryProvider

but do not hardcode fake Google Maps API behavior as real data.

If no Google Places/API provider is configured, return a clear server error explaining that a business-data provider is required.

The rest of the application must not depend directly on Google Maps.

This will allow a real provider to be added later without changing the Leads UI.

After businesses are discovered:

normalize the data

then save each lead into Firestore.

==================================================

10. OPENAI EMAIL GENERATION

==================================================

Create:

POST /api/ai/generate-email

Input:

{

  leadId: string

}

Server should:

1. Load the lead from Firestore.

2. Validate the lead belongs to the current user.

3. Send relevant lead information to OpenAI.

4. Generate a personalized outreach email.

5. Validate the response.

6. Save subject/body to the lead.

7. Set:

outreach.status = "generated"

outreach.approval = "pending"

Do not expose the OpenAI API key.

Use structured JSON output.

Expected AI result:

{

  subject: string,

  body: string

}

The prompt should instruct the AI:

- personalize based on available business information

- do not invent facts

- do not claim knowledge that is not present in the lead data

- keep the email concise

- professional tone

- clear call to action

- avoid generic mass-email language

==================================================

11. BULK EMAIL GENERATION

==================================================

Create:

POST /api/ai/generate-emails

Input:

{

  leadIds: string[]

}

Server should process only valid selected leads.

Do not create one giant prompt containing hundreds of leads.

Process leads individually or in controlled batches.

Return:

{

  success: true,

  results: [

    {

      leadId: string,

      success: boolean,

      error?: string

    }

  ]

}

Update each lead independently so one failed generation does not destroy the entire operation.

==================================================

12. AI REVIEW

==================================================

Create:

POST /api/ai/review-email

Input:

{

  leadId: string

}

Server:

1. Load lead.

2. Load generated email.

3. Send relevant data to OpenAI.

4. Ask AI to review the email.

5. Return structured JSON.

Expected:

{

  status: "approved" | "warning",

  issues: string[]

}

Review for:

- personalization

- clarity

- relevance

- unsupported claims

- excessive length

- weak CTA

- generic language

- obvious mistakes

Do not rewrite the email during review.

Save:

aiReview.status

aiReview.issues

aiReview.reviewedAt

==================================================

13. BULK AI REVIEW

==================================================

Create:

POST /api/ai/review-emails

Input:

{

  leadIds: string[]

}

Review each selected generated email.

Return individual results.

Do not fail the entire request because one lead fails.

==================================================

14. FIX ONE EMAIL

==================================================

Create:

POST /api/ai/fix-email

Input:

{

  leadId: string

}

Server:

1. Load lead.

2. Load current subject/body.

3. Load AI review issues.

4. Ask OpenAI to fix ONLY the identified problems.

5. Generate updated subject/body.

6. Review the updated email again.

7. Save the final result.

Expected behavior:

warning

→ fix

→ re-review

→ approved/warning

If still warning, keep the issues.

Never claim an email is approved unless the review actually returns approved.

==================================================

15. FIX ALL

==================================================

Create:

POST /api/ai/fix-emails

Input:

{

  leadIds: string[]

}

Only process leads whose:

aiReview.status === "warning"

Process independently.

Return:

{

  success: true,

  results: [

    {

      leadId: string,

      success: boolean,

      status: "approved" | "warning",

      error?: string

    }

  ]

}

==================================================

16. MANUAL APPROVAL

==================================================

Create:

POST /api/leads/:id/approve

Only allow approval if:

aiReview.status === "approved"

Then:

outreach.approval = "approved"

outreach.status = "ready"

outreach.approvedAt = serverTimestamp()

Also create:

POST /api/leads/bulk-approve

Only approve leads that passed AI review.

==================================================

17. EMAIL QUEUE

==================================================

Create:

POST /api/email/queue

Input:

{

  leadIds: string[]

}

Before queueing each lead validate:

email exists

AI review is approved

manual approval is approved

outreach has subject

outreach has body

Read:

minDelay

maxDelay

from settings.

Generate a random delay between them.

Create an emailQueue document.

Update lead:

sendStatus = "queued"

status = "queued"

Do not actually send the email yet if no email provider is connected.

==================================================

18. EMAIL SERVICE

==================================================

Create:

services/email.service.ts

Use an interface:

EmailProvider

Methods:

sendEmail({

  to,

  subject,

  body

})

Create provider abstraction for:

Gmail

SMTP

Do not tightly couple the Leads page to either provider.

For now, if no provider is configured, return:

EMAIL_PROVIDER_NOT_CONFIGURED

Do not fake a successful real email send.

==================================================

19. DELAY / QUEUE

==================================================

Keep the queue logic separate from the email provider.

Create helper:

getRandomDelay(minDelay, maxDelay)

Return seconds.

Do not use setTimeout inside an API request for long delays.

Do not keep a Next.js server request open for 90 seconds.

The queue should store:

scheduledAt

delaySeconds

This allows a future background worker/Cloud Function/cron process to process the queue.

For now, the frontend can display:

Queued

Waiting

Ready to send

without actually sending emails.

==================================================

20. FIREBASE SECURITY

==================================================

Never trust userId coming from the request body.

Get the authenticated user from the server-side auth/session.

Every Firestore query must be scoped to the current user.

For example:

where("userId", "==", currentUserId)

Do not allow:

GET /api/leads?id=another-user-lead

to expose another user's data.

Use Firebase Security Rules for client-side Firestore access.

Since most database operations are server-side through Firebase Admin, keep Admin credentials server-only.

==================================================

21. ENVIRONMENT VARIABLES

==================================================

Create/update:

.env.local

Expected variables:

OPENAI_API_KEY=

FIREBASE_PROJECT_ID=

FIREBASE_CLIENT_EMAIL=

FIREBASE_PRIVATE_KEY=

Do NOT commit .env.local.

Add/update .gitignore if necessary.

Never put OPENAI_API_KEY in NEXT_PUBLIC_* variables.

==================================================

22. ERROR HANDLING

==================================================

Use consistent API responses.

Success:

{

  success: true,

  data: ...

}

Error:

{

  success: false,

  error: {

    code: "ERROR_CODE",

    message: "Human readable message"

  }

}

Handle:

invalid input

lead not found

unauthorized access

OpenAI failure

Firebase failure

email provider not configured

missing email

AI review failure

queue failure

Do not expose internal stack traces to the client.

Log detailed errors server-side only.

==================================================

23. VALIDATION

==================================================

Use Zod for server-side request validation.

Validate:

category

city

country

limit

leadIds

settings

email data

Do not trust frontend validation alone.

==================================================

24. EXISTING FRONTEND

==================================================

Connect the existing frontend to these APIs.

Replace mock functions gradually.

Do not rewrite the existing UI.

The existing workflow should remain:

Settings

→ connect/configure email

Leads

→ generate leads

→ select leads

→ generate emails

→ AI review

→ fix warning

→ approve

→ queue

→ send

Keep loading states and error states.

==================================================

25. IMPORTANT: DO NOT OVERENGINEER

==================================================

This is a private internal tool.

Keep it simple.

Do NOT add:

- microservices

- Redis

- Kafka

- Docker

- Kubernetes

- complex event architecture

- unnecessary abstractions

- complicated state management

- unnecessary database collections

Use:

Next.js

Firebase

Firestore

OpenAI

simple service layer

simple API routes

==================================================

26. FILE STRUCTURE

==================================================

Prefer a structure similar to:

lib/

  firebase/

    admin.ts

  openai/

    client.ts

services/

  leads.service.ts

  ai.service.ts

  email.service.ts

  settings.service.ts

  business-discovery.service.ts

lib/

  validation/

    lead.schema.ts

    settings.schema.ts

    ai.schema.ts

app/

  api/

    leads/

      route.ts

      [id]/

        route.ts

        approve/

          route.ts

      bulk-delete/

        route.ts

      bulk-approve/

        route.ts

      generate/

        route.ts

    ai/

      generate-email/

        route.ts

      generate-emails/

        route.ts

      review-email/

        route.ts

      review-emails/

        route.ts

      fix-email/

        route.ts

      fix-emails/

        route.ts

    email/

      queue/

        route.ts

    settings/

      route.ts

Keep the exact structure flexible if my existing project has a better equivalent.

==================================================

27. IMPLEMENTATION ORDER

==================================================

Do NOT implement everything blindly in one step.

Implement in this order:

1. Firebase Admin setup

2. Firestore connection

3. Settings API

4. Leads CRUD

5. Connect existing Leads UI

6. OpenAI service

7. Generate email API

8. AI review API

9. Fix email API

10. Approval API

11. Email queue

12. Email provider abstraction

13. Business discovery abstraction

14. Connect everything

15. Test complete workflow

After each major step, check TypeScript errors and fix them before moving forward.

Do not break existing components.

At the end, provide a short summary of:

- files created

- files modified

- environment variables required

- APIs created

- Firestore collections

- anything that still requires external credentials