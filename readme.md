Chapter 1 — Problem Definition & Product Vision

Project Name: AI-Notification-Platform - AI Powered Event Driven Notification Platform

Document Version: 1.0

Author: Engineering Team

Status: Draft

1. Executive Summary

Modern software systems generate millions of operational, business, and security events every day. While these events contain valuable information, existing notification systems typically rely on static rules and simple threshold-based alerts. As organizations grow, this results in alert fatigue, delayed incident response, duplicated notifications, and overlooked critical events.

AI-Notification-Platform is an AI-powered Event-Driven Notification Platform designed to intelligently analyze incoming events, prioritize them based on business impact, eliminate duplicate notifications, recommend actions, and deliver the right notification to the appropriate recipient through the optimal communication channel.

Unlike traditional notification systems, AI-Notification-Platform combines event-driven architecture, artificial intelligence, rule engines, and workflow automation to reduce operational noise while increasing response speed and business awareness.

2. Background

Every modern application continuously emits events.

Examples include:

Business Events

Customer Registered
Order Created
Order Cancelled
Invoice Generated
Payment Failed
Refund Initiated

Operational Events

API latency increased
Server CPU exceeds threshold
Database unavailable
Disk nearing capacity
Kubernetes pod restarted

Security Events

Failed login attempts
Suspicious IP activity
Privilege escalation
API key misuse
Unauthorized access

Customer Experience Events

Cart abandoned
Subscription expiring
Trial ending
Support ticket opened

A medium-sized SaaS platform can easily generate millions of events per day.

Most of these events do not require immediate human intervention.

However, current systems often notify everything equally.

3. Problem Statement

Organizations face several operational challenges.

Alert Fatigue

Thousands of notifications are generated daily.

Teams begin ignoring alerts because most are not actionable.

Example

500 CPU alerts

400 Login alerts

120 Payment alerts

80 Deployment alerts

Only 5 actually require immediate attention.
Duplicate Notifications

A single failure can generate hundreds of nearly identical notifications.

Example

Database Down

↓

20 Microservices fail

↓

Each service sends its own alert

↓

Operations receives 20 emails

The root cause is only one incident.

Static Rule Systems

Current systems generally operate using simple rules.

Example

IF CPU > 90%

THEN Send Email

These rules ignore:

business importance
time of day
previous incidents
historical patterns
user roles
financial impact
No Business Context

Traditional monitoring systems understand infrastructure.

They rarely understand business.

Example

Payment Failed

Amount = ₹99

vs

Payment Failed

Amount = ₹15,00,000

Both generate identical alerts.

Business priority is dramatically different.

Poor Incident Prioritization

Not every event deserves immediate action.

Examples

Password expires in 7 days

↓

Low Priority

--------------------

Production Database Down

↓

Critical Priority

Current systems often treat both similarly.

Fragmented Communication

Organizations use multiple communication platforms.

Examples

Email
Slack
Microsoft Teams
SMS
WhatsApp
PagerDuty
Discord
Webhooks

Managing notification logic across all channels becomes increasingly complex.

4. Existing Solutions
Solution	Strength	Limitation
Email Notifications	Simple	High noise
Slack Bots	Fast	Channel overload
PagerDuty	Incident management	Expensive, infrastructure-focused
Grafana Alerts	Metrics	Limited business intelligence
Prometheus AlertManager	Reliable	Static rules
AWS SNS	Scalable	No AI analysis
Zapier / Make	Easy automation	Limited event intelligence
Custom Cron Jobs	Flexible	Difficult to maintain

Most existing platforms answer:

"Should I send a notification?"

AI-Notification-system answers:

"Should anyone be notified, who should it be, through which channel, how urgent is it, and what should they do next?"

5. Vision

Create an intelligent notification platform capable of understanding events before notifying users.

The platform should:

Analyze events using AI
Understand business impact
Detect duplicate incidents
Prioritize notifications
Recommend actions
Reduce unnecessary alerts
Deliver notifications through appropriate channels
Learn from historical behavior over time
6. Product Objectives

Primary objectives:

Reduce alert fatigue by at least 70%.
Improve Mean Time To Detect (MTTD).
Improve Mean Time To Resolve (MTTR).
Prioritize notifications based on business value.
Support millions of events per day.
Enable multi-tenant SaaS deployment.
Provide extensible notification channels.
Offer AI-assisted decision making.
7. Success Metrics (KPIs)
Metric	Target
Event ingestion success	99.99%
Notification delivery success	>99.9%
Average event processing latency	<2 seconds
AI response latency	<1 second (cached) / <5 seconds (LLM)
Duplicate alert reduction	>80%
False positive rate	<5%
Platform uptime	99.95%
Notification retry success	>99%
8. Stakeholders
Internal
Platform Engineers
SRE Team
AI Engineering Team
DevOps Team
Product Team
Security Team
External
SaaS Customers
Enterprise Clients
Developers integrating APIs
Operations Teams
Business Managers
9. Target Customers
Small Businesses

Need simple event notifications without complex infrastructure.

SaaS Companies

Require scalable event processing and intelligent routing.

Enterprise Organizations

Need governance, RBAC, audit logging, and compliance.

E-commerce Platforms

Monitor orders, payments, inventory, and customer activity.

Financial Institutions

Prioritize fraud detection and transaction alerts.

Healthcare Systems

Receive notifications for patient monitoring, system health, and compliance events.

10. Scope
In Scope (MVP)
Multi-tenant SaaS
Event ingestion API
Rule engine
AI-based event summarization
Severity classification
Email notifications
Slack notifications
Dashboard
API key authentication
Retry mechanism
Dead Letter Queue (DLQ)
Audit logging
Out of Scope (Future Releases)
Predictive analytics
Autonomous AI agents
Voice notifications
IoT device integration
Multi-region active-active deployment
AI-generated workflows
AI-based anomaly prediction
Custom ML model training per tenant
11. Assumptions
Events are immutable after ingestion.
Clients are responsible for generating events.
Event payloads follow a defined schema.
AI decisions are advisory and may be overridden by rules.
Notification channels can experience transient failures.
Tenants are logically isolated.
Each notification request is idempotent.
12. Constraints
Cloud-native deployment (Docker + Kubernetes).
Horizontal scalability.
At-least-once event processing.
Support for both synchronous APIs and asynchronous processing.
Minimize AI inference costs through intelligent routing and caching.
GDPR-compliant data handling for applicable tenants.
13. Risks
Risk	Impact	Mitigation
LLM latency	Delayed notifications	Asynchronous AI processing, caching, timeout fallback
Duplicate events	Notification spam	Idempotency keys, event deduplication
Queue overload	Processing delays	Horizontal worker scaling, backpressure
AI hallucinations	Incorrect recommendations	Rule engine remains authoritative, confidence scoring
External channel outage	Failed delivery	Retry with exponential backoff, DLQ, alternate channels
Noisy event sources	Increased infrastructure cost	Rate limiting, event sampling, source-level throttling
14. High-Level Product Flow
Event Producer
       │
       ▼
Event Ingestion API
       │
       ▼
Validation & Authentication
       │
       ▼
Event Store
       │
       ▼
Message Queue
       │
       ▼
AI Analysis + Rule Engine
       │
       ▼
Notification Decision
       │
       ▼
Channel Dispatcher
       │
       ▼
Email / Slack / Teams / SMS / Webhook
       │
       ▼
Delivery Status & Analytics

Chapter 1 Deliverables

By the end of this chapter, we have:

Defined the business problem and its real-world impact.
Established the product vision and measurable objectives.
Identified stakeholders, customers, scope, assumptions, constraints, and risks.
Outlined the end-to-end product flow that will guide the architecture in subsequent chapters.

# Chapter 2

---

# 2.1 Purpose

The objective of this chapter is to translate the business vision from Chapter 1 into **clear engineering requirements**.

This chapter defines:

* Functional Requirements (FR)
* Non-Functional Requirements (NFR)
* User Personas
* User Stories
* Use Cases
* Service Level Objectives (SLO)
* Capacity Planning
* Quality Attributes
* Acceptance Criteria

This serves as the contract between Product, Engineering, QA, DevOps, and AI teams.

---

# 2.2 Functional Requirements (FR)

## FR-1 Event Ingestion

The system shall accept events from external applications.

### Description

Applications can push events using REST APIs or future integrations like Kafka, Webhooks, or SDKs.

### Acceptance Criteria

* Validate API Key
* Validate Tenant
* Validate JSON Schema
* Generate Event ID
* Store raw payload
* Publish to Queue
* Return acknowledgment within SLA

Example

```http
POST /v1/events
```

---

## FR-2 Tenant Management

The platform shall support multiple organizations.

Each tenant has

* Users
* Notification Rules
* AI Settings
* Templates
* API Keys
* Billing
* Notification Channels

Acceptance Criteria

* Complete isolation
* Independent configuration
* Separate quotas
* Separate audit logs

---

## FR-3 Rule Engine

Users can create notification rules.

Example

```
IF

Payment Failed

AND

Amount > 5000

AND

Country = India

THEN

Notify Finance Team

Send Slack

Create Incident
```

Supported operators

* AND
* OR
* NOT
* Equals
* Contains
* Regex
* Greater Than
* Less Than

---

## FR-4 AI Analysis

Every event can optionally be analyzed by AI.

AI responsibilities

* Summarize
* Categorize
* Predict Severity
* Suggest Action
* Detect Duplicate Incident
* Detect Business Impact

Example

Input

```
Database CPU reached 99%.
```

Output

```
Severity:
Critical

Business Impact:
High

Recommendation:
Scale DB immediately.
```

---

## FR-5 Notification Dispatch

Supported Channels

* Email
* Slack
* Teams
* Discord
* SMS
* WhatsApp
* Push Notification
* Webhook

Requirements

* Retry
* Rate Limit
* Delivery Tracking
* Status Updates

---

## FR-6 Templates

Users manage templates.

Variables

```
{{user}}

{{amount}}

{{severity}}

{{eventType}}

{{summary}}
```

Supports

* HTML
* Markdown
* Plain Text

---

## FR-7 Notification History

Every notification must be tracked.

Status

* Pending
* Processing
* Sent
* Failed
* Retrying
* Dead Letter Queue

---

## FR-8 Dashboard

Dashboard displays

Real Time

* Active Events
* Failed Notifications
* AI Suggestions
* Event Timeline
* Analytics

Historical

* Daily Events
* Success Rate
* Notification Cost
* Top Incident Sources

---

## FR-9 Audit Logging

Every important action is logged.

Examples

* User Login
* API Key Created
* Rule Updated
* Notification Sent
* AI Decision Generated

---

## FR-10 API Management

Developers can

* Create API Keys
* Rotate Keys
* Revoke Keys
* Set Rate Limits

---

# 2.3 Non Functional Requirements (NFR)

---

## Scalability

Support

* 100,000 tenants
* Millions of events/day
* Horizontal scaling
* Zero downtime deployments

---

## Availability

Target

99.95%

Downtime

```
<22 minutes/month
```

---

## Reliability

Event loss

```
0
```

Every accepted event must eventually be processed.

---

## Performance

| Operation             | Target |
| --------------------- | ------ |
| Event API Response    | <100ms |
| Queue Publish         | <20ms  |
| AI Summary            | <2 sec |
| Notification Dispatch | <1 sec |
| Dashboard API         | <300ms |

---

## Security

Must support

* JWT
* OAuth2
* API Keys
* RBAC
* Audit Log
* Encryption at Rest
* TLS

---

## Observability

Provide

* Metrics
* Traces
* Logs
* Dashboards
* Alerts

---

## Extensibility

Adding a new notification channel should not require changes to existing channels.

Open/Closed Principle.

---

## Maintainability

Independent modules

* AI
* Rules
* Notifications
* Dashboard

---

# 2.4 User Personas

---

## Platform Admin

Responsibilities

* Manage Platform
* Billing
* Tenants
* Global Settings

---

## Tenant Admin

Responsibilities

* Create Rules
* Manage Users
* Create Templates
* Configure Channels

---

## Developer

Responsibilities

* Integrate APIs
* Push Events
* Monitor Delivery

---

## Operations Engineer

Responsibilities

* Monitor Incidents
* Resolve Failures
* Review AI Suggestions

---

## Business Manager

Responsibilities

* Review Reports
* Monitor KPIs
* Configure Business Rules

---

# 2.5 User Stories

---

### Story 1

As a developer,

I want to send events using REST API,

so that my application can trigger notifications.

---

### Story 2

As a platform admin,

I want to isolate tenant data,

so customers cannot access each other's information.

---

### Story 3

As an SRE,

I want AI to summarize incidents,

so I understand problems quickly.

---

### Story 4

As a finance manager,

I only want payment failures above ₹10,000,

so I don't receive unnecessary alerts.

---

### Story 5

As a support engineer,

I want duplicate alerts grouped,

so I receive only one actionable incident.

---

# 2.6 Use Case Diagram (Textual)

```
Developer

↓

Send Event

↓

Platform

↓

Validate

↓

Store Event

↓

Queue

↓

AI Analysis

↓

Rule Engine

↓

Notification Decision

↓

Dispatch

↓

Email

Slack

Webhook

↓

Delivery Status

↓

Dashboard
```

---

# 2.7 Primary Use Cases

## UC-01 Send Event

Actor

Developer

Flow

```
Create Event

↓

POST API

↓

Authentication

↓

Validation

↓

Store

↓

Queue

↓

Return Success
```

---

## UC-02 AI Analysis

```
Queue Event

↓

Generate Summary

↓

Predict Severity

↓

Suggest Action

↓

Return Result
```

---

## UC-03 Notification

```
Rule Matched

↓

Choose Channel

↓

Render Template

↓

Send Notification

↓

Update Status
```

---

# 2.8 SLA

Availability

99.95%

Notification Delivery

99.9%

API Availability

99.99%

---

# 2.9 SLO

Event accepted

```
99.99%
```

Notification latency

```
<2 sec
```

AI response

```
<5 sec
```

Queue processing

```
<500ms
```

---

# 2.10 Error Budget

99.95%

Allowed downtime

```
21.9 minutes/month
```

Error Budget

```
0.05%
```

Engineering may consume this budget during deployments or incidents while still meeting the service objective.

---

# 2.11 Capacity Planning

Assume

```
1000 Customers
```

Each customer

```
100 Employees
```

Each employee

```
20 Events/day
```

Total

```
1000

×

100

×

20

=

2 Million Events/day
```

Peak Traffic

```
10×

Average
```

Peak

```
20 Million Events/day
```

Required throughput

```
≈232 Events/sec average

≈2315 Events/sec peak
```

This becomes the minimum architecture target.

---

# 2.12 Data Retention

Raw Events

```
90 Days
```

Notification Logs

```
365 Days
```

Audit Logs

```
7 Years
```

Metrics

```
18 Months
```

---

# 2.13 Security Requirements

Must support

* JWT Authentication
* API Keys
* OAuth Login
* RBAC
* Tenant Isolation
* Secret Management
* IP Allow List (Enterprise)
* Rate Limiting
* Audit Trail

---

# 2.14 Compliance Requirements

Target compliance

* GDPR
* SOC2 Type II
* ISO 27001 (future)
* HIPAA (optional deployment profile)

---

# 2.15 Quality Attributes

| Attribute       | Priority | Reason                                            |
| --------------- | -------- | ------------------------------------------------- |
| Availability    | Critical | Notifications are time-sensitive                  |
| Scalability     | Critical | Must handle millions of events/day                |
| Reliability     | Critical | Events cannot be lost                             |
| Security        | Critical | Multi-tenant SaaS handling sensitive data         |
| Performance     | High     | Low-latency processing and delivery               |
| Maintainability | High     | Independent, testable modules                     |
| Extensibility   | High     | Easy addition of new channels and AI capabilities |
| Observability   | High     | Essential for production operations               |
| Cost Efficiency | Medium   | Optimize AI inference and infrastructure costs    |
| Portability     | Medium   | Deployable across major cloud providers           |

---

# 2.16 Engineering Principles

To guide all future design decisions, the platform follows these principles:

* **Event-Driven First:** Asynchronous processing wherever possible.
* **API-First:** Every capability is exposed through versioned APIs.
* **Cloud Native:** Containerized, horizontally scalable, and orchestration-ready.
* **AI-Assisted, Not AI-Dependent:** Core business workflows continue even if AI is unavailable.
* **Idempotent Processing:** Safe retries without duplicate side effects.
* **Tenant Isolation:** Logical isolation in the MVP, with a path to physical isolation for enterprise deployments.
* **Observability by Default:** Every service emits metrics, logs, and traces.
* **Security by Design:** Authentication, authorization, encryption, and auditing are built into the platform rather than added later.

---

## Deliverables of Chapter 2

By the end of this chapter, we have converted the product vision into concrete engineering requirements. We now know:

* **What** the system must do (Functional Requirements).
* **How well** it must do it (Non-Functional Requirements).
* **Who** will use it (Personas and User Stories).
* **What scale** it must support (Capacity Planning).
* **How success will be measured** (SLA, SLO, Error Budget).
* **Which architectural qualities** are most important (Quality Attributes and Engineering Principles).

These requirements become the foundation for all design decisions in the next chapters.

**microservice architecture**

I actually think a **microservice architecture** is the right choice for this project because your goal isn't just to build a notification platform—it's to demonstrate distributed systems, AI integration, and production architecture for your portfolio. The important part is **using each communication protocol where it fits best**, rather than trying to use one protocol everywhere.

---

# My Recommendation

Use **all four** communication styles.

Each solves a different problem.

| Communication           | Use                             | Why                               |
| ----------------------- | ------------------------------- | --------------------------------- |
| REST                    | External APIs                   | Public, simple, SDK-friendly      |
| GraphQL                 | Frontend aggregation | Reduce frontend round trips       |
| gRPC                    | Internal service-to-service     | Fast, strongly typed, low latency |
| Events (RabbitMQ/Kafka) | Async workflows                 | Decoupling, retries, scalability  |

This is how many large-scale systems are designed.

---

# Recommended Architecture

```text
                    Browser
                        │
                 HTTP / HTTPS
                        │
                        ▼
                 API Gateway (REST)
                        │
        ┌───────────────┼────────────────┐
        │               │                │
     Auth API      Event API      Analytics API
        │               │                │
        └───────────────┼────────────────┘
                        │
                 Internal gRPC
                        │
──────────────────────────────────────────────────────
Tenant Service
User Service
Rule Service
Notification Service
AI Service (NestJS -- calls OpenAI / Claude / Gemini)
Template Service
Channel Service
Analytics Service
Audit Service
──────────────────────────────────────────────────────
                        │
                RabbitMQ / Kafka
                        │
               Async Event Processing
                        │
                        ▼
        Prediction Service (Python -- XGBoost / PyTorch / TensorFlow)
```

---

# GraphQL

Most traffic is:

* event ingestion
* notification processing
* AI analysis
* workers

These are **commands**, not **graph queries**.

GraphQL is strongest for rich UI data retrieval.

Example:

Dashboard wants:

* User
* Events
* Notification stats
* AI summary
* Charts

Without GraphQL:

```text
GET /users

GET /events

GET /analytics

GET /notifications

GET /incidents
```

With GraphQL:

```graphql
query Dashboard {
    dashboard {
        user
        activeEvents
        analytics
        notifications
    }
}
```

One request.

Much better.
Only use GraphQL for the dashboard or FE rich UI.

---

# REST

Use REST only for external/public APIs.

Examples

```http
POST /v1/events

POST /auth/login

POST /apikeys

GET /events

GET /notifications
```

Why?

Every programming language understands REST.

Customers can integrate easily.

---

# gRPC

Everything inside the platform should use gRPC.

Example

```
API Gateway

↓

Event Service

↓

gRPC

↓

AI Service
```

Instead of HTTP.

Advantages

* Binary protocol
* HTTP/2
* Strong typing
* Proto contracts
* Faster serialization
* Code generation

---

# Event Communication

Never call another service synchronously if you don't need an immediate response.

Example

Customer sends

```text
Payment Failed
```

Don't do

```
Event Service

↓

Notification Service

↓

Email Service

↓

Slack Service
```

Use

```
Event Service

↓

RabbitMQ

↓

Notification Worker

↓

RabbitMQ

↓

Email Worker

↓

Slack Worker
```

Now everything scales independently.

---

# Suggested Service List

## API Gateway

Responsibilities

* Authentication
* Rate limiting
* API Keys
* Request routing

No business logic.

---

## Identity Service

* Users
* Roles
* JWT
* OAuth

---

## Tenant Service

* Organizations
* Plans
* Billing
* Quotas

---

## Event Service

Core service.

Responsibilities

* Event ingestion
* Validation
* Event storage
* Publish EventCreated

---

## AI Service

Calls AI models. Does not train them.

Responsibilities

* Event processing (orchestration)
* Rule evaluation orchestration
* Notification orchestration
* AI summarization
* AI recommendations
* Prompt orchestration
* Duplicate detection

Since this service calls external LLM providers (OpenAI / Claude / Gemini) rather than
training or serving its own models, **Node.js (NestJS) is sufficient** -- it stays
consistent with the rest of the platform's services instead of introducing a second
runtime for what is fundamentally I/O-bound orchestration.

---

## Prediction Service

A dedicated **Python** ML service, separate from the AI Service above.

Where the AI Service calls someone else's model, the Prediction Service trains and
serves ours.

Responsibilities

* Fraud detection
* Demand forecasting
* Time series models
* Computer vision
* Recommendation engines

Uses Python's ML ecosystem:

* XGBoost
* PyTorch
* TensorFlow

```text
        API Gateway
             │
─────────────────────────────
Auth
Tenant
Event
Notification
AI (NestJS)
─────────────────────────────
             │
             ▼
 OpenAI / Claude / Gemini

─────────────────────────────
Prediction Service (Python)
─────────────────────────────
             │
             ▼
 XGBoost / PyTorch / TensorFlow
```

---

## Rule Engine Service

Responsibilities

* Evaluate rules
* Return actions

---

## Notification Service

Responsibilities

* Notification lifecycle
* Retry scheduling
* Delivery tracking

---

## Channel Service

Instead of Notification Service sending emails directly.

Separate connectors.

```
Notification

↓

Email Connector

Slack Connector

SMS Connector

Webhook Connector
```

Easy to extend.

---

## Template Service

Stores

* Email templates
* Slack templates
* Variables

---

## Analytics Service

Consumes events only.

Never blocks production traffic.

---

## Audit Service

Consumes every event.

Completely asynchronous.

---

# Communication Matrix

| From                 | To                   | Protocol                | Why                    |
| -------------------- | -------------------- | ----------------------- | ---------------------- |
| Browser              | API Gateway          | HTTPS/REST              | Public API             |
| Dashboard            | API Gateway          | GraphQL                 | UI requests            |
| API Gateway          | Auth Service         | gRPC                    | Fast auth              |
| API Gateway          | Event Service        | gRPC                    | Internal command       |
| Event Service        | AI Service           | RabbitMQ                | Async AI processing    |
| Event Service        | Rule Service         | RabbitMQ                | Decoupled processing   |
| AI Service           | Notification Service | RabbitMQ                | Publish analyzed event |
| AI Service           | Prediction Service   | gRPC                    | Request a prediction   |
| Rule Service         | Notification Service | RabbitMQ                | Notification commands  |
| Notification Service | Email Connector      | gRPC                    | Immediate send request |
| Notification Service | Slack Connector      | gRPC                    | Immediate send request |
| Notification Service | SMS Connector        | gRPC                    | Immediate send request |
| All Services         | Audit Service        | Event Bus               | Fire-and-forget        |
| All Services         | Analytics Service    | Event Bus               | Stream processing      |

---

# RabbitMQ Exchanges

```
event.created

event.validated

event.ai.completed

event.rule.matched

notification.created

notification.sent

notification.failed

notification.retry

notification.dead

audit.created
```

Every service subscribes only to events it cares about.

---

# Database Strategy

**Database per service**.

```
Identity DB

Tenant DB

Event DB

Notification DB

Analytics DB

Audit DB
```

No cross-service SQL joins.

Communication happens through APIs or events.

---

# API Gateway Responsibilities

```
Authentication

↓

Authorization

↓

Rate Limiting

↓

API Key Validation

↓

Request Validation

↓

Routing

↓

Response Aggregation
```

No business logic.

---

# AI Communication

AI is expensive.

Don't invoke it synchronously.

```
Event Created

↓

RabbitMQ

↓

AI Service (NestJS)

↓

OpenAI / Claude / Gemini

↓

Summary

↓

Publish AICompleted

↓

Notification Service
```

This prevents slow LLM calls from delaying event ingestion.

When the AI Service needs a prediction rather than a generative response (fraud score,
demand forecast, anomaly likelihood), it calls the Prediction Service over gRPC instead
of an LLM provider:

```
AI Service (NestJS)

↓ gRPC

Prediction Service (Python)

↓

XGBoost / PyTorch / TensorFlow

↓

Prediction Response
```

The two are separate services because they scale and fail differently: the AI Service
is bound by third-party LLM API latency and rate limits, while the Prediction Service is
bound by local model inference and benefits from Python's ML tooling.

---

# One Change I'd Make

I would **replace RabbitMQ with Kafka only if your primary requirement becomes extremely high event throughput** (hundreds of thousands to millions of events per second), long-term event retention, or stream replay.

For an AI notification SaaS, **RabbitMQ is an excellent starting choice** because it provides:

* Reliable work queues
* Flexible routing
* Dead-letter queues
* Retry handling
* Lower operational complexity

Kafka can be introduced later for analytics or event streaming without replacing RabbitMQ entirely.

---

## Final Architecture Recommendation

* **Frontend ↔ API Gateway:** REST over HTTPS (consider GraphQL only for dashboard aggregation).
* **API Gateway ↔ Backend Services:** gRPC.
* **Business Workflows:** Event-driven using RabbitMQ.
* **Channel Connectors:** gRPC for immediate dispatch.
* **AI Processing:** Asynchronous via RabbitMQ.
* **Analytics & Audit:** Consume events asynchronously.
* **Database:** One database per service with no direct cross-service access.
* **AI vs. Prediction:** The AI Service (NestJS) orchestrates calls to external LLM
  providers; the Prediction Service (Python) trains and serves in-house ML models. Two
  services because they scale and fail differently, not because of a technology
  preference.

Infrastructure Bootstrap

We'll build the actual foundation in this order:

Initialize the Turborepo with pnpm workspaces.
Configure shared TypeScript settings, ESLint, Prettier, Husky, and Commitlint.
Create the shared packages (config, logger, common, grpc, etc.).
Scaffold the NestJS services (including the AI Service) and the Python Prediction Service.
Create the initial docker-compose.yml with PostgreSQL, RabbitMQ, Redis, Jaeger, Prometheus, Grafana, PgAdmin, and all application services.
Verify inter-service communication with a simple health-check flow.

This gives us a production-grade development platform before we implement the first business feature. From there, we'll implement the API Gateway and Auth Service end-to-end.


**Development process**s

Scaffolding
1. ✅ Turborepo + pnpm workspaces
2. ✅ Shared TS/ESLint/Prettier/Husky/Commitlint
3. ✅ Shared packages (config, logger, common, grpc, telemetry)
4. ✅ NestJS services + Python Prediction Service
Bootstrapping
5. ✅ docker-compose.yml with all infra + observability + app services
6. ✅ Verify inter-service communication with a simple health-check flow.
   Every service (11 NestJS + prediction-service) now runs the standard
   grpc.health.v1.Health service alongside its REST API. api-gateway's
   GET /internal/service-health calls all 11 other services over real
   internal gRPC (Docker service DNS, not the host-mapped REST ports) and
   aggregates their status. Verified live: all report SERVING; stopping
   identity-service made it report UNREACHABLE with the actual gRPC error,
   and it returned to SERVING once restarted.

   "This gives us a production-grade development platform before we implement the first business feature. From there, we'll implement the API Gateway and Auth Service end-to-end."

Features
7. ✅ API Gateway + Auth Service end-to-end (register/login/JWT/OAuth).
   identity-service: Prisma + Postgres-backed User model, POST
   /auth/register, POST /auth/login (bcrypt), GET /auth/me (passport-jwt
   guard), GET /auth/google + /auth/google/callback (passport-google-oauth20,
   conditionally registered only when GOOGLE_CLIENT_ID/SECRET are set --
   no real Google credentials in this environment, so the actual consent-
   screen round trip is unverified, but register/login/JWT/gRPC are). A
   second gRPC microservice exposes auth.v1.Auth/ValidateToken. api-gateway's
   GET /protected/ping demonstrates "API Gateway -> Auth Service: gRPC, Fast
   auth" from the architecture doc: a guard extracts the bearer token and
   validates it over real internal gRPC (not local JWT verification).

   Verified live end-to-end, including two real bugs caught only by
   running it: the Docker CMD ran `node dist/main.js` directly, bypassing
   package.json's `start` script -- so `prisma migrate deploy` never
   actually ran in the container (fixed: CMD now runs migrate deploy
   itself when a prisma/schema.prisma exists); and this machine's native
   Postgres on 127.0.0.1:5432 silently won the "localhost" resolution over
   Docker's port-forward, so the first migration attempt landed in the
   wrong database entirely (fixed: compose Postgres moved to host port
   5433). Proved the migrate-on-boot fix by dropping identity_db entirely
   and confirming a fresh container applied the migration itself before
   serving traffic.

8. ✅ Tenant Service (organizations, membership, RBAC).
   tenant-service: Prisma + Postgres-backed `Tenant` and `TenantMember`
   models. REST API under `/tenants` -- create, list (scoped to the
   caller's own memberships, with pagination/search/sort query params),
   get, update, delete -- plus membership management
   (list/add/update-role/remove members), all behind a guard that
   validates the bearer token over real internal gRPC against
   identity-service (the same "API Gateway -> Auth Service" pattern,
   reused here for a downstream service rather than the gateway). A
   second gRPC microservice exposes `tenant.v1.Tenant/GetTenant` and
   `/CheckMembership` for other services to look up tenants without a
   REST round trip.

   Introduced two shared abstractions in `@ai-notification/common` ahead
   of the other business services: `BaseCrudService` (generic
   create/findUnique/update/delete/list over a Prisma delegate, with
   `list()` handling `?page=&limit=`, `?search=` -- a JSON object for
   per-field filters or a plain string for fuzzy OR-search across
   caller-declared fields -- and `?sort_fields=&sort_type=`) and
   `BaseCrudController` (the matching REST surface) for services with
   plain, ownerless CRUD. tenant-service itself doesn't fit that
   ownerless shape -- every route needs the caller's identity to enforce
   membership/role checks, which TypeScript's method-override rules
   correctly reject as incompatible with the base class's unscoped (id
   -only) signatures -- so `TenantsController` composes `TenantsService`
   directly instead of extending the base controller, while
   `TenantsService` still extends `BaseCrudService` for its internal
   Tenant CRUD.

   Verified live end-to-end against the real containerized stack:
   registered users via identity-service, created tenants, exercised
   pagination/fuzzy-search/sort on the list endpoint, and confirmed the
   authorization edge cases actually hold -- 403 when a plain member
   tries to update tenant settings, 401 with no bearer token, 404 (not
   403) for a non-member requesting a tenant by id so existence isn't
   leaked, and 403 when trying to remove a tenant's last remaining
   owner.

   Caught one real pre-existing bug along the way: identity-service and
   tenant-service both pin the same `@prisma/client` version, so pnpm
   deduped them to a single physical location in the store -- each
   service's `prisma generate` was silently overwriting the other's
   generated model code (confirmed: after generating tenant-service's
   client, identity-service's `User` model was gone from the shared
   output). Fixed by giving each service's Prisma generator its own
   `output` path (`apps/<service>/generated/prisma-client`, gitignored),
   isolating the generated client per service regardless of version
   overlap.

9. ✅ Event Service (ingestion, first RabbitMQ producer).
   event-service: Prisma + Postgres-backed `Event` model. REST API:
   `POST /events` (ingest), `GET /events?tenantId=` (paginated/search/
   sort, scoped), `GET /events/:id`. Every route required a valid JWT
   *and* tenant membership -- the latter checked over real gRPC against
   tenant-service via `checkMembershipViaGrpc` (the same client built for
   tenant-service's own `GetTenant`/`CheckMembership`, now consumed by a
   second service), the first concrete use of "internal gRPC" between two
   business services rather than gateway-to-service.

   Added `@ai-notification/rabbitmq`: a lifecycle-managed
   `RabbitMQService`/`RabbitMQModule` wrapping `amqplib` directly (no
   NestJS microservices RMQ transport, no `@golevelup` wrapper) --
   `amqplib` is already auto-instrumented for tracing by the existing
   OpenTelemetry setup (`getNodeAutoInstrumentations()` bundles it), so
   this got distributed tracing for free. Publishes to a durable topic
   exchange `platform` with routing key `event.created`, matching the
   RabbitMQ exchange list from the architecture chapter above --
   available now for rule-engine-service/ai-service/notification-service
   to consume from once they're built. Extended `BaseCrudService.list()`
   with an optional `baseWhere` filter (ANDed with `?search=`), needed
   for tenant-scoped listing and immediately reused, not speculative.

   Verified live: ingested an event, confirmed `status: "published"`,
   and independently confirmed via RabbitMQ's own management API
   (`/api/exchanges/%2F/platform`) that `publish_in` incremented --
   proof the message actually reached the broker, not just that the
   client call didn't throw. Also exercised the authorization edges
   (400 missing tenantId, 401/403/404).

   Caught one real bug live: an unhandled promise rejection in the
   RabbitMQ reconnect path. Node treats unhandled rejections as fatal,
   so a transient disconnect during the broker's own startup crashed the
   whole event-service process. Fixed with a `scheduleReconnect()` that
   catches its own failures and retries indefinitely instead of letting
   one rejected `connect()` bring the process down.

10. ✅ Route every public API through api-gateway only.
    Until this point, identity-service/tenant-service/event-service each
    exposed REST directly (ports 8001/8002/8003) *in addition to*
    api-gateway -- inconsistent with the architecture chapter above
    (API Gateway Responsibilities: Authentication -> Authorization ->
    Routing, "No business logic"; Communication Matrix: gateway talks to
    every backend over gRPC). Restructured so api-gateway is the only
    public door: identity/tenant/event-service's REST controllers were
    deleted outright (gRPC-only internally, keeping just `/health` for
    the Dockerfile's own healthcheck), and their full REST surfaces were
    rebuilt in api-gateway as thin gRPC proxies.

    Auth model for the internal calls: api-gateway is the only place
    that ever resolves a bearer token to a user (already did this via
    `GrpcAuthGuard`/`validateTokenViaGrpc`). It passes the resolved
    `requesterId` as an explicit field on every outgoing gRPC request;
    tenant-service/event-service's membership/role-check logic is
    completely unchanged, it just now reads `userId` off the gRPC
    message instead of a locally-populated `req.user`.

    Also added, as part of this pass since none of it existed yet:
    forgot/reset-password (`PasswordResetToken` model, SHA-256-hashed
    tokens, 1h expiry; no SMTP configured in this environment so the
    reset token is logged rather than emailed, same "no real credentials
    here" stance as Google OAuth) and moved Google OAuth's strategy/
    controller from identity-service to api-gateway entirely -- the
    browser has to reach the OAuth redirect/callback directly, so that
    can't live behind the gRPC boundary; the callback now calls
    identity-service's `ValidateOAuthUser` RPC instead of a local
    `AuthService`.

    Expanding ~20 new RPCs (register/login/me/forgot/reset/oauth, 8
    tenant CRUD+membership ops, 3 event ops) made per-RPC hand-rolled
    gRPC client boilerplate too repetitive, so `@ai-notification/grpc`
    gained two shared pieces used throughout: `callUnary()` (wraps the
    deadline/invoke/close plumbing once) and a matched pair,
    `GrpcExceptionFilter` (server side) / `throwAsHttpException` (client
    side), so a service method can keep throwing the exact same
    `ConflictException`/`NotFoundException`/etc. it always did and
    api-gateway gets the right HTTP status back automatically.

    That exception-filter pair is also where the pass caught its one
    real bug: NestJS's gRPC transport hands whatever an exception filter
    returns straight to grpc-js's `call.emit("error", ...)`, which reads
    `.code`/`.message` directly off that value. The first version
    returned `new RpcException({code, message})` -- but `RpcException`
    hides its payload behind `.getError()` instead of exposing `.code`
    directly, so every mapped status silently degraded to
    UNKNOWN/500. Confirmed live (`POST /auth/register` on a duplicate
    email came back 500 instead of 409) before fixing it to return the
    plain `{code, message}` object the transport actually expects --
    confirmed again afterward (409/401 came back correctly).

    Verified live end-to-end through port 8000 only, phase by phase:
    full auth flow including forgot/reset-password with token-reuse
    rejection; tenant CRUD and membership with every authorization edge
    case (401/403/404) re-run against the gateway; event ingestion with
    the RabbitMQ publish re-confirmed via the exchange API. Confirmed
    ports 8001/8002/8003 no longer accept connections at all. Full
    workspace build+lint (35 packages) clean throughout all three
    phases.

11. ✅ Rule Engine Service (first RabbitMQ consumer, event.created ->
    event.rule.matched).
    rule-engine-service: Prisma-backed `Rule`/`RuleMatch` models,
    gRPC-only CRUD (`POST/GET/PATCH/DELETE /rules` via api-gateway,
    identical shape/auth pattern to tenant-service and event-service).
    A pure `evaluate()` function (`src/rules/rule-evaluator.ts`)
    implements FR-3's full operator set from Chapter 2 above --
    AND/OR/NOT/Equals/Contains/Regex/GreaterThan/LessThan -- against a
    flattened `{type, source, tenantId, ...payload}` context, so the
    FR-3 example (`Payment Failed AND Amount > 5000 AND Country = India`)
    maps directly onto a rule's `eventType` + `conditions` tree.

    This is the first RabbitMQ *consumer* in the codebase -- everything
    before this only published. Added `RabbitMQService.consume()` to
    `@ai-notification/rabbitmq`: binds a durable queue to a topic
    exchange/routing key and dispatches each message to a handler,
    ack'ing on success and nack'ing (no requeue) on a thrown error. Consumer
    registrations are stored and replayed on every (re)connect -- the same
    defensive pattern `publish()` already used for re-asserting exchanges
    after a reconnect -- which also means `consume()` is safe to call
    before the service's first connection finishes. `RuleConsumerService`
    uses it to bind `rule-engine.event.created` to the `platform`
    exchange's `event.created` key; on each event it loads the tenant's
    enabled rules (matching the event's type or `"*"`), evaluates them,
    and for every match writes a `RuleMatch` row and publishes
    `event.rule.matched` -- ready for notification-service to consume
    once it exists. Deliberately out of scope this pass (flagged, not
    forgotten): no dead-letter queue, no action *execution* (that's
    notification-service/channel-service), no rule-builder UI.

    Verified live: created a rule (`amount > 5000 AND country ==
    "India"`), posted one matching event and one non-matching event
    through api-gateway, and confirmed via a direct database query that
    exactly one `RuleMatch` row was created -- proving the AND-condition
    actually discriminates rather than always firing -- with a matching
    single log line from `RuleConsumerService`. Cross-checked against
    RabbitMQ's management API: `publish_out: 2` on the `platform`
    exchange, confirming both `event.created` messages were actually
    routed to the new queue. Re-confirmed the standard 400/401/404
    authorization edges and that port 8005 accepts no direct
    connections. Full workspace build+lint (35 packages) clean.

12. ✅ Notification Service (second RabbitMQ consumer, notification
    lifecycle + retries).
    notification-service: a `Notification` model tracking FR-7's exact
    status lifecycle from Chapter 2 above (`pending -> sent |
    retrying -> dead_letter`), read-only gRPC CRUD (`GET
    /notifications?tenantId=&status=`, `GET /notifications/:id` via
    api-gateway). This is where rule-engine-service's `Rule.actions` --
    left deliberately unshaped when that service was built, since nothing
    consumed it yet -- got a real contract: `{ channel: string, target:
    string, template?: string }` per action, with malformed entries
    skipped (logged, not fatal) rather than failing the whole match.

    The second RabbitMQ consumer in the codebase: `NotificationConsumerService`
    binds to the `platform` exchange's `event.rule.matched` key (reusing
    `RabbitMQService.consume()` added for rule-engine-service) and turns
    each action into a tracked `Notification` row.

    Channel Service and Template Service (FR-6) don't exist yet, so
    "dispatch" is simulated rather than real: `DispatchSimulatorService`
    logs "would send via {channel} to {target}" -- the same "no real
    external integration configured" convention as identity-service's
    forgot-password token -- and deterministically fails when `target`
    contains `"fail"`, so the retry/dead-letter path is actually
    exercisable in verification instead of just theoretical.
    `RetrySchedulerService` is a hand-rolled `setInterval` poller (10s/
    30s/60s backoff, 3 max attempts by default) rather than adopting
    BullMQ against the Redis already sitting unused in docker-compose --
    consistent with how `RabbitMQService`'s own reconnect logic is a
    manual retry loop, not a library; BullMQ remains a sensible future
    upgrade, flagged rather than adopted here. Every lifecycle transition
    publishes `notification.created`/`sent`/`retry`/`dead` on the
    `platform` exchange, per the RabbitMQ exchange list above.

    Verified live: created a rule with two actions -- one normal target,
    one deliberately containing `"fail"` -- and posted a matching event.
    The first notification reached `status: "sent"` immediately; the
    second cycled through `"retrying"` (confirmed `attempts` incrementing
    and `lastError` populated at each step) and, after polling through
    the real backoff schedule, landed on `"dead_letter"` -- confirmed via
    a direct database query, not just the log line. Re-verified through
    the REST API too (status filter, get-by-id), all standard 400/401/403
    authorization edges, RabbitMQ `publish_out` increasing further with
    the new queue bound, and that port 8006 accepts no direct
    connections. Full workspace build+lint (35 packages) clean.

13. ✅ AI Service (third RabbitMQ consumer, event.created ->
    event.ai.completed; multi-provider LLM analysis + RAG duplicate
    detection).
    ai-service: the third independent consumer of `event.created`
    (alongside rule-engine-service and notification-service's own
    upstream) -- a topic exchange fans the same routing key out to every
    bound queue, no coordination needed between consumers. An
    `EventAnalysis` model tracks FR-4's fields (summary, category,
    severity, businessImpact, recommendation, isDuplicate/duplicateOfEventId)
    plus `status`/`error` so an LLM failure is a queryable row, not a
    silently dropped message. Read-only gRPC CRUD (`GET
    /ai-analyses?tenantId=`, `GET /ai-analyses/:id`, `GET
    /ai-analyses/by-event/:eventId`) via api-gateway, same shape as every
    prior service's read surface.

    Not locked to one LLM: a `TenantAiConfig` model lets each tenant pick
    its provider (Anthropic/OpenAI/Ollama) and model independently, write-
    gated to `owner`/`admin` (reusing `checkMembershipViaGrpc`'s `role`
    field and tenant-service's own `MANAGE_TENANT_ROLES` convention rather
    than adding a new one), read open to any member; an unconfigured
    provider (no API key on this deployment) is rejected with a 400 at
    write time rather than accepted and left to fail silently later.
    Absence of a row falls back to a platform default
    (`DEFAULT_AI_PROVIDER`). All three providers sit behind one
    `LangchainProvider` using LangChain's `ChatAnthropic`/`ChatOpenAI`/
    `ChatOllama` + `.withStructuredOutput()`, rather than three hand-rolled
    SDK integrations -- one code path, one prompt, one Zod schema.

    Duplicate detection is retrieval-augmented rather than a flat SQL
    filter: before calling the LLM, `SimilarEventRetrieverService` embeds
    the new event's description (Ollama's `nomic-embed-text`, run locally
    regardless of which provider does the analysis itself) and compares it
    by cosine similarity against the tenant's recent completed analyses,
    passing only genuinely similar ones as prompt context. This catches a
    duplicate reported under a *different* event type/wording, which an
    exact `type` match would have missed entirely.

    Real problems hit building this, not just theoretical ones:
    - The Anthropic SDK's `zodOutputFormat()` helper needs Zod v4's
      internal schema shape; this workspace pins Zod v3 everywhere.
      Fixed by building the JSON Schema for `output_config.format` by
      hand (same approach already needed for OpenAI's structured outputs)
      instead of pulling in a second Zod major version for one helper.
    - The RAG similarity threshold was wrong on the first pass: 0.75
      looked reasonable but, measured directly against Ollama's embeddings
      endpoint, a genuine duplicate scored ~0.72 against its own stored
      summary (comparing a raw event description to an LLM-generated
      summary scores lower than comparing same-register text) while an
      unrelated event scored ~0.56 -- retuned to 0.65 after confirming
      that gap held.
    - A pasted-in-chat OpenAI key was treated as already exposed (never
      written anywhere but a gitignored root `.env`, rotation recommended
      regardless) -- and its account genuinely had no billing quota,
      confirmed independently with a raw `curl` straight to OpenAI's API
      outside the app, which is exactly the case the `status: "failed"` +
      `error` field exists for: caught, logged, persisted, no crash.
    - Running a real local model surfaced real hardware limits, not
      simulated ones: `llama3.1:8b` was OOM-killed under Docker Desktop's
      then-3.8GB VM limit (raised to 7.75GB); `llama3.2:3b` worked but
      took 12+ minutes on one call once RAG context lengthened the prompt,
      and its CPU usage starved sibling containers badly enough to cause
      unrelated gRPC calls to time out; `llama3.2:1b` was still too slow;
      `smollm2:135m` was fast (~19s) but incoherent (a date string as a
      "recommendation" field). Landed on `qwen2.5:0.5b` -- coherent output
      in 15-20s on this hardware. Confirmed the RAG retrieval mechanism
      itself was correct (using a larger model as a control) before
      accepting, as an honest capability limit rather than a bug, that a
      0.5B model won't reliably act on retrieved duplicate context even
      though the retrieval feeding it is right.

    Verified live: real completed analyses from both OpenAI (before its
    quota ran out) and a fully local Ollama model, each producing a
    genuine summary/severity/businessImpact/recommendation -- not stub
    text. Tenant AI-config RBAC re-run against the gateway (403 for a
    plain member, 200 read for any member, 400 for an unconfigured
    provider). RabbitMQ `publish_out` confirmed incrementing per
    `event.created` message with both rule-engine-service's and
    ai-service's queues bound to it independently. Standard 401/404
    authorization edges, and port 8004 accepts no direct connections.
    Full workspace build+lint clean throughout.

14. ✅ Channel Service (real Email/Webhook connectors) + real-time
    WebSocket dashboard push.
    channel-service: replaces notification-service's old
    `DispatchSimulatorService` with real external delivery.
    Stateless -- no database, no RabbitMQ -- a pure gRPC connector layer
    (`Dispatch(channel, target, payload_json) -> {success, error}`)
    behind one `ChannelConnector` interface, called only by
    notification-service; no REST surface, no api-gateway route, no auth
    of its own. `EmailConnector` sends real Gmail SMTP via `nodemailer`
    (App Password required once 2FA is on); `WebhookConnector` POSTs with
    an 8s timeout, success defined as any 2xx. Both fail gracefully
    (`{success: false, error}`) rather than throwing when unconfigured or
    unreachable, feeding straight into notification-service's existing
    retry/dead-letter machinery instead of a new error path.

    The harder half of this pass was the user's own architecture
    refinement: RabbitMQ transports notification events, it does not
    replace Postgres as the source of truth, and the dashboard needs
    real-time browser push rather than a client polling `GET
    /notifications` on a timer. Implemented as api-gateway's first-ever
    RabbitMQ consumer plus a `@WebSocketGateway` (Socket.IO):
    notification-service publishes `notification.dashboard.push` for the
    `dashboard` channel (marking `status: "sent"` immediately -- there's
    no meaningful "retry a live push," a disconnected user just sees the
    row later as `readStatus: "unread"` over REST); api-gateway relays it
    to `tenant:${tenantId}` socket rooms. A new `readStatus`
    (`unread`/`read`) field is intentionally separate from the existing
    delivery-lifecycle `status` field, exactly as proposed. JWT is
    validated at handshake (reusing `validateTokenViaGrpc`) and tenant
    membership is re-checked at subscribe-time (`checkMembershipViaGrpc`)
    rather than trusting a client-claimed `tenantId` -- the same
    never-trust-the-client convention as every REST endpoint's tenant
    checks. `@socket.io/redis-adapter` is wired in even at single-instance
    scale, since it's the standard correctness fix the moment api-gateway
    ever runs more than one replica.

    Two real bugs surfaced during this, not simulated ones:
    - A genuine race condition: a test client emitting `"subscribe"`
      immediately on `"connect"` ran ahead of `handleConnection`'s async
      JWT-validation gRPC call, so `handleSubscribe` saw `userId:
      undefined` and its own guard clause disconnected the socket --
      manifesting as an opaque "server namespace disconnect." Root-caused
      by running the container with `DEBUG=socket.io:*,engine:*` for
      protocol-level logs and isolating via a no-op handler that survived
      cleanly. Fixed with an explicit `authenticated` event emitted once
      `handleConnection` actually finishes, which clients must wait for
      before subscribing.
    - NestJS's global `ValidationPipe({whitelist: true})` also governs
      WebSocket `@MessageBody()`, not just REST DTOs -- a plain TS
      interface for the subscribe payload had no `class-validator`
      metadata to whitelist against. Fixed by giving it a real
      `SubscribeDto` class, the same convention every REST DTO in this
      codebase already follows.

    Verified live: a real Gmail email actually received end-to-end; a
    real webhook success against a live listener and a real
    failure/retry/dead-letter cycle against an unreachable host
    (replacing the old fake `target.includes("fail")` simulation with
    genuine unreachability); a WebSocket client connect -> authenticated
    -> subscribed -> live `notification` event sequence with zero
    disconnects after the fixes above; an offline user's dashboard
    notification still landing in Postgres as `readStatus: "unread"`,
    fetchable and mark-as-readable later over REST. Standard auth edges
    (missing/garbage token both rejected at handshake) and port isolation
    (no direct host access to channel-service) re-checked.

15. ✅ Template Service ({{variable}} rendering for FR-6, wired into
    every channel).
    The email delivered in #14 rendered as raw `{"template": null}` --
    `RuleAction.template` had existed since rule-engine-service was built
    but nothing ever rendered it into content. template-service closes
    that gap: a `Template` model keyed by `(tenantId, name, channel)`
    since one logical template needs a different shape per channel (a
    full subject+body email version vs. a body-only dashboard version of
    the same alert), standard Prisma CRUD via api-gateway
    (`POST/GET/PATCH/DELETE /templates`), plus an internal
    (no-`requester_id`) `RenderTemplate` gRPC method that notification-
    service calls, not the gateway. Rendering itself
    (`src/templates/render.ts`) is deliberately minimal -- straight
    `{{variable}}` substitution, no control flow or partials, per FR-6's
    stated scope.

    The actual missing link wasn't template-service itself, it was that
    `event.rule.matched` (rule-consumer.service.ts) never carried the
    original event's `type`/`source`/`payload` -- only rule metadata --
    so there was nothing to substitute variables *from*. Added those
    three fields to that publish call and threaded them through
    notification-consumer.service.ts into `createFromMatch`, which now
    builds the same flattened `{type, source, tenantId, ...payload}`
    context rule-engine already uses for condition evaluation (plus an
    `eventType` alias for `type`, matching FR-6's documented variable
    name) and renders it per action when `action.template` is set.

    Every channel benefits from one render step rather than three: a
    found template stores `payload: {subject, body}`; no template (or a
    template name that doesn't exist, e.g. a stale reference) falls back
    to storing the flattened event context itself rather than a
    placeholder -- so even an untemplated notification shows real data,
    never `{template: null}`. channel-service's `EmailConnector` was
    updated to use `payload.subject`/`payload.body` directly when
    present, falling back to its old pretty-printed-JSON behavior
    otherwise; webhook and dashboard already forwarded `payload` verbatim,
    so rendered content flows through them with no channel-specific
    change at all -- confirming the earlier design bet that dashboard
    "needs templates too" for free once rendering happens upstream in
    notification-service.

    Verified live end-to-end: a real Gmail email with a rendered
    subject/body containing actual event data (not `{{tokens}}`, not raw
    JSON); a rule action with no template producing a notification
    `payload` of flattened event context instead of the old placeholder;
    a rule action referencing a nonexistent template name degrading
    gracefully to the same fallback rather than crashing or dead-
    lettering the dispatch; a dashboard-channel template rendering and
    arriving over the live WebSocket push from #14 with real substituted
    variables, confirmed both in the socket payload and via
    `GET`/`PATCH .../read` over REST afterward. Standard 400/401/403/404
    authorization edges on `/templates` re-checked, and port 8008 accepts
    no direct connections. Full workspace build+lint clean.

16. ✅ Analytics Service (fourth/fifth/sixth RabbitMQ consumer, daily
    aggregate stats for FR-8's historical dashboard).
    The Communication Matrix has every service fire-and-forget into
    Analytics Service over the event bus ("Stream processing," never
    blocking production traffic), with its own `analytics_db` per the
    Database Strategy section. Rather than storing raw events -- which
    would just duplicate event-service/notification-service's own tables
    and violate "database per service, no cross-service joins" -- it
    consumes `event.created`/`notification.sent`/`notification.dead` off
    the existing `platform` exchange and turns them into daily `upsert`
    counters (`DailyEventStat` keyed by `tenantId/date/eventType/source`,
    `DailyNotificationStat` keyed by `tenantId/date/channel`), read back
    through three aggregate endpoints mapping directly onto FR-8's
    "Historical" bullets: `GET /analytics/daily-events`, `GET
    /analytics/top-sources`, `GET /analytics/notifications` (success rate
    + an explicitly-estimated cost, computed at query time from a
    `CHANNEL_COST_JSON` env var since no cost/pricing concept exists
    anywhere else in the codebase). Deliberately left out FR-8's "Real
    Time" bullets (Active Events, Failed Notifications, AI Suggestions,
    Event Timeline) -- those are just the dashboard querying
    event-service/notification-service/ai-service's own existing
    endpoints directly, nothing new to build there.

    Real end-to-end verification (posting real events through the actual
    event -> rule -> notification -> channel pipeline, not synthetic
    RabbitMQ messages) caught a genuine bug the first synthetic-message
    pass had missed: the dashboard channel never publishes
    `notification.sent` at all -- it's fire-and-forget, publishing
    `notification.dashboard.push` instead (see #14) and updating its own
    status directly. Analytics Service was silently missing the entire
    dashboard channel from every notification stat as a result. Fixed by
    adding a fourth consumer bound to `notification.dashboard.push`,
    counted as a `sent` event for the `dashboard` channel -- confirmed
    live afterward with a fresh dashboard-channel notification correctly
    appearing in the stats.

    Also surfaced mid-build: bringing up ~10 services at once for a live
    verification pass overloaded the user's machine badly enough to
    require killing Docker Desktop entirely -- verification going forward
    uses the minimal service set actually needed for whatever's under
    test (here: analytics-service + api-gateway + auth, with the
    RabbitMQ-consuming pipeline services added deliberately for the
    real-pipeline re-test rather than assumed by default), brought up a
    few at a time rather than one large parallel build.

    Verified live twice: once via synthetic messages published directly
    onto RabbitMQ (`event.created`/`notification.sent`/`notification.dead`
    with varied types/sources/channels) to confirm the aggregation math in
    isolation; once via the real pipeline end-to-end (three rules across
    all three channels -- dashboard, email, webhook -- the webhook
    deliberately unreachable to drive a real `dead_letter` through the
    actual retry backoff, not a shortcut). Both passes' arithmetic checked
    out exactly against what was posted (daily counts, top-source
    ordering, per-channel sent/failed, success rate, estimated cost).
    Standard 400/401/403 authorization edges (missing `tenantId`,
    missing/bad token, non-member tenant), port 8009 accepting no direct
    connections, and full workspace build+lint clean.

17. ✅ Audit Service (third/fourth/fifth consumer on `platform`, FR-9
    logging across five services).
    FR-9 names five audit examples: User Login, API Key Created, Rule
    Updated, Notification Sent, AI Decision Generated. API Key Created
    was skipped outright -- a full grep confirmed API keys are FR-10 and
    were never built, nothing exists to hook into. Of the remaining four,
    two already flow through the `platform` exchange unchanged
    (`notification.sent`, `event.ai.completed` -- audit-service just
    binds to them, same as analytics-service). The other two -- rule
    CRUD and login -- published nothing at all before this pass, so
    unlike analytics-service this required adding small publish calls to
    two other services rather than only writing a new consumer.

    Rather than inventing a bespoke routing key per new action, both
    reuse one generic `audit.created` event (the exact name already
    sitting in the PRD's own RabbitMQ exchange list), shaped
    `{action, tenantId, actorId, targetType, targetId, metadata}`:
    `rules.service.ts`'s `create`/`updateRule`/`remove` now each publish
    it (`rule.created`/`rule.updated`/`rule.deleted`, actor = the
    requester); identity-service's `auth.service.ts` publishes it once,
    from `login()` only -- not `register()` or OAuth, matching FR-9's
    literal "User Login" wording rather than guessing whether account
    creation counts. identity-service had zero RabbitMQ usage before this
    (no dependency, no `RABBITMQ_URL`, no `RabbitMQModule` import) -- this
    is its first-ever use of the bus.

    `AuditLog` rows are deliberately generic (`tenantId`/`actorId`
    nullable, `action`/`targetType`/`targetId`/`metadata`) rather than one
    table per action type, since every FR-9 example reduces to the same
    shape. Two read endpoints cover the two real scoping cases: `GET
    /audit-logs?tenantId=&days=&action=` (tenant-membership gated, shows
    everything -- human and system-caused -- inside that tenant) and `GET
    /audit-logs/me?days=` (no tenant check needed at all -- `actorId =
    requester` alone is sufficient authorization, and naturally covers
    both a user's own logins *and* their own rule changes across every
    tenant they belong to, in one query).

    Also carried over explicitly from the last session's feedback: never
    bring up many services in one large parallel `docker compose
    --build`. Every container in this pass was rebuilt and health-checked
    one or two at a time.

    Verified live: registered and logged in a real test user -- confirmed
    a `user.login` row via `/audit-logs/me` (and confirmed registration
    alone produced *no* row, matching the login-only scope). Created,
    renamed, and deleted a real rule through the REST API -- all three
    `rule.created`/`rule.updated`/`rule.deleted` rows appeared correctly
    in `/audit-logs?tenantId=`. Published synthetic `notification.sent`
    and `event.ai.completed` messages directly onto RabbitMQ (no need to
    run notification-service/ai-service/channel-service/event-service) to
    confirm those two reused keys map correctly. Confirmed the `action`
    query filter and `/audit-logs/me`'s cross-action scoping (returned
    all four of the test user's own rows: one login, three rule changes).
    Standard 400/401/403 authorization edges, port 8010 accepting no
    direct connections, and full workspace build+lint clean.