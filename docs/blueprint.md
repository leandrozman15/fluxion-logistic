# **App Name**: Fluxion Radar

## Core Features:

- Manual Prospect Entry: Allow users to manually input individual prospect data directly into the system, including company details and contact information.
- CSV Prospect Import: Facilitate bulk import of prospect data via CSV files, supporting column mapping and tracking of import progress, processed rows, and errors.
- Automated Prospect Data Enrichment Tool: Automatically attempt to enrich prospect records with missing information such as domain, corporate email addresses, and phone numbers when available, using intelligent tools to find relevant data.
- Industrial Relevance Scoring Tool: Calculate and assign a relevance score (0-100) to each prospect, based on criteria like website presence, CNPJ validity, and industry tags, providing transparent score reasons through an intelligent tool.
- CRM-style Prospect Pipeline: Track prospects through a configurable sales pipeline (e.g., new, contacted, interested, demo, client, discarded) with status updates and follow-up scheduling.
- Prospect Data Deduplication: Automatically prevent duplicate prospect entries based on unique identifiers like CNPJ and domain within each tenant's database.
- Targeted Contact Campaigns: Create, configure, and manage targeted contact campaigns primarily via email, with options to generate WhatsApp direct links (wa.me) for prospects.
- Email Rate Limiting: Enforce strict daily and hourly email sending limits per tenant to ensure responsible communication practices and prevent spam.
- Dynamic Email Template Editor: Provide a user interface to create, edit, and manage reusable email templates with support for dynamic variables that personalize messages (e.g., {{companyName}}).
- Secure Multi-Tenant Architecture: Implement Firebase security rules and data modeling to ensure strict data isolation, allowing each client company (tenant) to access only their own data.
- Role-Based User Management: Manage user accounts, assign roles (admin, sales, viewer), and control access permissions to different features and data within a tenant.
- Firebase Cloud Functions Backend: Utilize Cloud Functions for server-side business logic, including user authentication triggers, CSV processing, data enrichment, scoring, campaign scheduling, and email sending.
- Asynchronous Task Processing: Leverage Cloud Tasks and Cloud Scheduler for managing queues, implementing rate limiting, and executing recurring background jobs efficiently.
- Scalable Data Storage with Firestore: Implement Firestore for NoSQL data storage and Firebase Storage for file uploads (e.g., CSVs), ensuring a robust, scalable, and reliable data foundation.
- Next.js Frontend Deployment: Deploy a modern, fast, and responsive user interface built with Next.js (App Router) on Firebase Hosting for global availability.
- Dashboard & KPIs: Provide a dashboard displaying key performance indicators such as new prospects, contacted, interested leads, and demo figures.

## Style Guidelines:

- Primary color: A professional, dark desaturated blue (#2C3E50) to convey reliability and focus.
- Secondary color: A lighter, cool grey (#ECF0F1) for backgrounds and subtle separation of elements, ensuring cleanliness.
- Accent color: A muted orange (#E67E22) used sparingly for interactive elements, highlights, and status badges to draw attention without being overwhelming.
- Text color: Dark grey (#34495E) for primary text content, ensuring high readability against light backgrounds.
- Body and headline font: 'Roboto' (sans-serif) for its clean, modern, and highly readable characteristics, fitting an industrial aesthetic.
- Use minimalist, outline-style icons for navigation, actions, and data categories to maintain a clean and functional interface.
- Employ a structured, modular layout with clear card-based components and ample whitespace to organize complex information effectively.
- Information density should be balanced, with key data points highlighted and easy to scan.
- Subtle and quick animations for state changes, loading indicators, and form submissions to provide responsive feedback without distracting the user.
- Transition effects should be minimal and purposeful, enhancing the user experience rather than adding complexity.