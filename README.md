# MIVCHAT — AI-Powered Chat & Coding Workspace

> **Think. Create. Code. Build.**

MIVCHAT is an AI-powered chat and development workspace developed by Olivier Munezero and Kirenga Sano Ivan

designed to help users explore ideas, understand complex concepts, write code, work with files, and build digital experiences in one place.

Combining conversational AI with coding assistance and a live website preview, MIVCHAT aims to make learning, programming, and creative problem-solving more accessible through a modern, intuitive interface.

The project brings together AI conversations, code presentation, file handling, authentication, chat history, and web preview capabilities in a single workspace.

---

## Table of Contents

- [About MIVCHAT](#about-mivchat)
- [Project Vision](#project-vision)
- [Key Features](#key-features)
- [The Workspace Experience](#the-workspace-experience)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [How the Application Works](#how-the-application-works)
- [Security Considerations](#security-considerations)
- [Deployment](#deployment)
- [Performance and Future Improvements](#performance-and-future-improvements)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About MIVCHAT

MIVCHAT is being developed as a unified environment for interacting with artificial intelligence and creating software.

Traditional AI chat interfaces primarily focus on conversations. Development tools, on the other hand, focus on editing and running code. MIVCHAT brings these experiences closer together by allowing users to discuss problems, generate code, inspect formatted responses, and preview supported web content within a shared workspace.

The goal is to reduce friction between having an idea and turning that idea into something useful.

MIVCHAT is an evolving project, and its features and architecture may change as development continues.

## Project Vision

The vision behind MIVCHAT is to create an accessible digital workspace where people can:

- Learn programming through practical examples and explanations.
- Explore ideas with an AI assistant.
- Generate and understand code.
- Preview supported web content without constantly switching windows.
- Work with supported files and documents.
- Organize conversations and return to previous work.
- Build projects through an increasingly integrated development experience.

MIVCHAT is intended to grow beyond a basic chatbot into a more complete environment for learning, coding, and digital creation.

## Key Features

### 1. AI-Powered Conversations

MIVCHAT connects to Google's Gemini API to provide AI-generated responses.

The conversational interface is designed to support tasks such as:

- Asking questions and exploring concepts.
- Getting help with programming problems.
- Generating and reviewing code.
- Understanding technical topics.
- Brainstorming project ideas.
- Working through problems in a conversational format.

AI responses depend on the configured model, available context, API limits, and service availability.

### 2. Developer-Friendly Code Display

Programming code should be readable, structured, and easy to inspect.

MIVCHAT uses Markdown rendering and syntax-highlighting tools to present supported code blocks with language-aware formatting.

The interface also supports mathematical notation through KaTeX, making it useful for displaying equations and technical explanations.

### 3. Live Website Preview

One of MIVCHAT's central goals is to bring generated web content closer to the conversation.

The workspace includes a preview area designed to display supported content, including HTML and SVG, depending on the implementation.

The preview experience is intended to make it easier to inspect the output of generated code without losing the context of the conversation.

Workspace controls include resizing the preview panel and managing the preview area.

> Previewing code is not the same as safely executing arbitrary code. Sandboxing and security controls are important when expanding this functionality.

### 4. File Uploads and File Processing

MIVCHAT includes file-handling functionality intended to help users work with supported documents and other inputs.

Depending on the file type and implemented processing support, the application can extract or process content for use in AI workflows.

The backend includes file-processing dependencies for formats such as Word documents, spreadsheets, and ZIP archives.

Actual format support and file-size limits depend on the current backend implementation and configuration.

### 5. File Generation

The backend includes file-generation functionality, allowing the application to support workflows where users need downloadable outputs rather than only text responses.

Supported output formats depend on the current implementation and installed dependencies.

### 6. Authentication

MIVCHAT uses Supabase Authentication to support user accounts and sign-in workflows.

Configured authentication providers may include:

- Google
- GitHub
- Discord

Provider availability depends on the configuration of the Supabase project and the relevant OAuth applications.

### 7. Chat History

MIVCHAT integrates with Supabase for conversation storage.

The application uses database tables named `chats` and `messages` for its conversation-history workflow.

This enables supported account-based workflows to save and retrieve previous conversations, helping users continue their work later.

### 8. Workspace Preferences

The interface includes workspace preferences such as theme selection and layout customization.

The workspace is designed to retain relevant preferences across sessions, with persistence depending on the current implementation and browser environment.

### 9. Feedback Workflow

The backend includes a feedback endpoint that uses Resend to deliver feedback messages by email.

This provides a communication channel for collecting feedback and improving the application.

Email delivery requires valid environment variables and an appropriately configured Resend account.

### 10. Modern Interface

MIVCHAT is built around a modern, responsive interface with a dark, cinematic visual direction featuring teal and violet accents.

The design emphasizes:

- Readable conversations.
- Clear visual hierarchy.
- Developer-friendly code presentation.
- A workspace that combines chat and preview.
- Responsive layout behavior.
- A consistent experience across supported screen sizes.

---

## The Workspace Experience

MIVCHAT is intended to bring several activities together in one workflow.

A typical workflow might look like this:

1. Start a conversation about a programming problem.
2. Ask the AI to explain a concept or generate an example.
3. Inspect the response and its syntax-highlighted code.
4. Preview supported web content.
5. Refine the result through additional messages.
6. Upload or generate supported files when necessary.
7. Save the conversation and return to it later.

This workflow aims to reduce unnecessary context switching and make experimentation more convenient.

---

## Technology Stack

MIVCHAT uses a JavaScript-based frontend and backend, alongside managed authentication and database services.

| Technology | Purpose |
|---|---|
| React | Building the user interface |
| Vite | Frontend development server and production build tooling |
| JavaScript | Application logic |
| CSS | Styling, layout, themes, and responsive design |
| Node.js | Backend JavaScript runtime |
| Express | HTTP API and backend routing |
| Google Gemini API | AI-powered response generation |
| Supabase | Authentication and database services |
| React Markdown | Rendering Markdown responses |
| Remark GFM | Supporting GitHub-Flavored Markdown |
| Syntax highlighting | Presenting readable code blocks |
| KaTeX | Rendering mathematical notation |
| Lucide React | Interface icons |
| Mammoth | Processing supported Word document content |
| ExcelJS | Working with spreadsheet data |
| JSZip | Working with ZIP archives |
| Resend | Email delivery for feedback workflows |

The exact versions and installed dependencies are recorded in the relevant `package.json` files.

---

## Architecture

MIVCHAT separates the frontend interface from backend services.

```text
                 USER
                   |
                   v
          React + Vite Frontend
                   |
          HTTP API Requests
                   |
                   v
           Express Backend
             /     |      \
            /      |       \
           v       v        v
        Gemini  Supabase   Resend
          API    Services   Email
```

### Frontend

The frontend is responsible for:

- Rendering the user interface.
- Displaying AI conversations.
- Managing workspace interactions.
- Presenting Markdown and code.
- Handling supported uploads.
- Communicating with the backend.
- Integrating with Supabase authentication and history features.

### Backend

The Express backend is responsible for server-side API operations, including:

- Handling chat requests.
- Communicating with the Gemini API.
- Applying request limits and validation.
- Processing supported file inputs.
- Generating supported files.
- Sending feedback emails through Resend.

### External Services

MIVCHAT relies on external services for selected capabilities:

- **Gemini:** AI response generation.
- **Supabase:** Authentication and database operations.
- **Resend:** Feedback email delivery.

These services may have separate usage limits, availability constraints, and pricing policies.

---

## Project Structure

The project is organized into a frontend at the repository root and a backend inside the `server/` directory.

```text
mochat/
├── public/
├── src/
│   ├── App.jsx
│   ├── App.css
│   └── ...
├── server/
│   ├── server.js
│   ├── package.json
│   └── ...
├── index.html
├── package.json
├── package-lock.json
├── .gitignore
├── README.md
└── ...
```

This is a simplified overview. Actual files and folders may differ as development progresses.

- `src/` contains the React application.
- `src/App.jsx` contains the main application component.
- `src/App.css` contains application styling.
- `server/server.js` contains the Express backend.
- `server/package.json` defines backend dependencies and scripts.
- `package.json` defines frontend dependencies and scripts.
- `README.md` documents the project.

---

## Getting Started

### Prerequisites

Before running MIVCHAT locally, install the following:

- [Node.js](https://nodejs.org/) — use a supported LTS version compatible with the project dependencies.
- npm — included with Node.js.
- [Git](https://git-scm.com/) — for version control.
- A Supabase project for authentication and database functionality.
- A Google AI Studio API key for Gemini-powered features.
- A Resend account and API key if email feedback is enabled.

You should also have a code editor such as [Visual Studio Code](https://code.visualstudio.com/).

### 1. Clone the Repository

After the repository is published, clone it:

```bash
git clone https://github.com/YOUR_USERNAME/mivchat.git
cd mivchat
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Install Frontend Dependencies

From the project root, run:

```bash
npm install
```

This installs the dependencies listed in the frontend package manifest.

### 3. Install Backend Dependencies

Open a terminal in the backend directory:

```bash
cd server
npm install
```

Return to the project root when you need to run frontend commands:

```bash
cd ..
```

### 4. Configure Environment Variables

Create a `.env` file inside the `server/` directory for backend secrets.

Create a root `.env` file for frontend variables only if the frontend implementation uses them.

Do not commit real secret values to GitHub.

### 5. Start the Backend

Open a terminal:

```bash
cd server
npm run start
```

The exact command depends on the scripts defined in `server/package.json`. If the project does not define a `start` script, use the appropriate existing script or configure one.

The backend uses the `PORT` environment variable when provided and otherwise defaults to port `3001`.

### 6. Start the Frontend

Open another terminal at the project root:

```bash
npm run dev
```

Vite typically serves the frontend at:

```text
http://localhost:5173
```

Use the local URL printed by Vite if it differs.

Keep both development servers running while testing the full application.

---

## Environment Variables

MIVCHAT uses environment variables to configure private credentials and service endpoints.

### Backend Variables

The backend may require the following variables, depending on the enabled features:

| Variable | Purpose |
|---|---|
| `PORT` | Port used by the Express server |
| `GEMINI_API_KEY` | Secret key for Gemini API requests |
| `GEMINI_MODEL` | Optional AI model configuration |
| `RESEND_API_KEY` | Secret key for Resend email delivery |
| `FEEDBACK_TO` | Email address that receives feedback |
| `FRONTEND_URL` | Production frontend origin permitted by CORS |

An example backend `.env` file:

```dotenv
PORT=3001
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_configured_model
RESEND_API_KEY=your_resend_api_key
FEEDBACK_TO=your_feedback_email@example.com
FRONTEND_URL=http://localhost:5173
```

This is an example of variable names and configuration structure, not a file to copy blindly. Confirm which variables your current `server.js` actually reads and use a real model name supported by your Gemini account.

Never replace real credentials with placeholders in a production environment and expect the corresponding service to work.

### Frontend Variables

If the frontend uses Vite environment variables, they must begin with `VITE_`.

Common examples include:

```dotenv
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

Only add these variables if the frontend code reads them. If the frontend currently has Supabase configuration hardcoded, update the code before expecting these variables to take effect.

Vite exposes `VITE_` variables to browser code. Never put Gemini secret keys, Resend secret keys, Supabase service-role keys, or other private credentials in frontend environment variables.

### Environment Variable Security

- Keep `.env` and `.env.*` files out of version control, except deliberately maintained example templates.
- Use `.env.example` files with placeholder values to document configuration.
- Store production credentials in the deployment platform's environment-variable settings.
- Rotate a credential immediately if it is accidentally exposed.
- Never include secrets in screenshots, public issue reports, or committed configuration files.

---

## Running the Application

A typical local development session uses two terminals.

**Terminal 1 — Backend**

```bash
cd server
npm run start
```

**Terminal 2 — Frontend**

```bash
npm run dev
```

Then open the frontend URL provided by Vite.

### Production Build

To build the frontend for production:

```bash
npm run build
```

Vite generates production assets in the `dist/` directory.

To test the built frontend locally, you can use:

```bash
npm run preview
```

The preview server is intended for testing the built frontend. It does not replace the Express backend or deploy the application publicly.

---

## How the Application Works

### Chat Requests

The frontend sends user messages to the Express backend. The backend validates incoming requests and uses the configured Gemini API to generate responses.

A simplified flow:

1. The user enters a message.
2. The frontend sends an HTTP request.
3. The backend validates the request.
4. The backend calls the AI service.
5. The generated response is returned.
6. The frontend renders the response.

The actual request format and response behavior depend on the current API implementation.

### Authentication and History

Supabase provides authentication and database functionality.

When a user signs in, the frontend can use the authenticated session to support account-based workflows. Chat-history operations interact with the configured database tables and depend on the project's access policies.

Database access policies should ensure that users can only access data they are authorized to view or modify.

### File Processing

Supported file inputs are handled through the relevant frontend and backend workflows.

The backend may extract text or structured content from supported documents before using that content in an application feature.

File processing should validate file type, size, and content. A file extension alone does not prove that a file is safe.

### Website Preview

The preview panel is designed to display supported web content while keeping the conversation accessible.

When adding more preview capabilities, the implementation should carefully isolate untrusted HTML, JavaScript, and other active content from the main application and its authentication credentials.

---

## Security Considerations

Security is an ongoing part of building MIVCHAT.

### API Credentials

Private API credentials belong on the backend or in secure deployment settings, never in public frontend code.

### CORS

The backend should allow requests from the intended frontend origins rather than permitting every origin without a specific reason.

Local development origins and production deployment origins may be different.

### Authentication

Authentication should be paired with appropriate database authorization rules. Hiding an interface element is not a substitute for enforcing permissions on the server or in database policies.

### Request Validation

API endpoints should validate inputs, apply reasonable size limits, and return useful errors without exposing private configuration details.

### Rate Limiting

Rate limiting can help reduce excessive requests. It is not a complete defense against abuse, and production deployments may require additional monitoring and controls.

### Uploaded Files

Uploaded files can contain malicious or unexpected content. File processing should use appropriate validation, size limits, and safe parsing practices.

### Live Preview

Untrusted HTML or JavaScript should not be executed with unrestricted access to the application's session, storage, or credentials.

### Production Readiness

Before a public launch, review:

- API authentication and authorization.
- Database access policies.
- CORS configuration.
- Secret management.
- Error handling and logging.
- File upload limits.
- Abuse prevention.
- Backup and recovery procedures.
- Dependency vulnerabilities.

---

## Deployment

MIVCHAT's frontend and backend can be deployed separately.

A possible deployment arrangement is:

| Component | Suggested platform |
|---|---|
| React/Vite frontend | Vercel |
| Express backend | Render |
| Authentication and database | Supabase |
| AI responses | Google Gemini API |
| Feedback email | Resend |

These are deployment options, not a guarantee that every service or feature is available without charge.

### Frontend Deployment

For a standard Vite frontend, the typical production build command is:

```bash
npm run build
```

The output directory is:

```text
dist
```

Configure the production frontend API URL to point to the deployed backend rather than `localhost`.

### Backend Deployment

Configure the backend service to install dependencies from the `server/` directory and run the project's configured production start command.

Set all required backend environment variables in the hosting platform.

The backend should use the port supplied by the hosting provider and allow the deployed frontend origin through CORS.

### Supabase Configuration

After deploying the frontend, configure the correct production site URL and authentication redirect URLs in Supabase.

OAuth providers may also require updated redirect configuration.

See the [Supabase Authentication Redirect URLs documentation](https://supabase.com/docs/guides/auth/redirect-urls).

### Production Testing

After deployment, test:

- The landing page and navigation.
- Sign-up and sign-in.
- OAuth sign-in, if enabled.
- Sending AI messages.
- Code and Markdown rendering.
- Supported uploads and downloads.
- Chat-history persistence.
- Feedback email delivery.
- Website preview behavior.
- Mobile and desktop layouts.

A successful frontend deployment does not automatically mean that the backend, OAuth providers, database policies, or external APIs are configured correctly.

---

## Performance and Future Improvements

MIVCHAT is an evolving project. Potential areas for further development include the following.

### Frontend Performance

- Split large JavaScript bundles using dynamic imports.
- Lazy-load features that are not needed immediately.
- Optimize large components and expensive rendering operations.
- Improve loading and error states.
- Optimize the experience on slower devices and networks.

### AI Experience

- Improve conversation-context management.
- Make errors and rate limits easier to understand.
- Add configurable model options where appropriate.
- Improve handling of long responses and large inputs.

### Coding Workspace

- Expand supported preview formats.
- Improve preview isolation and sandboxing.
- Add better code organization and file management.
- Improve the transition between generated code and previewed output.

### File Workflows

- Expand supported formats where useful.
- Improve file-validation feedback.
- Add clearer progress indicators for longer operations.
- Improve error messages for unsupported or malformed files.

### Reliability and Security

- Expand automated testing.
- Improve monitoring and structured logging.
- Review authentication and database policies.
- Strengthen API authorization and abuse prevention.
- Add documented recovery and backup procedures.

These are potential improvements, not promises that every feature has already been implemented.

---

## Contributing

Contributions, suggestions, and constructive feedback are welcome.

### Suggested Contribution Workflow

1. Fork the repository or create a branch if you have permission.
2. Create a branch for your change.
3. Make a focused improvement.
4. Test the relevant functionality.
5. Check that no secrets or private configuration files are included.
6. Submit a pull request describing the change.

Example:

```bash
git checkout -b feature/your-improvement
```

Use descriptive branch names and commit messages.

For bug reports, include the steps needed to reproduce the issue, the expected behavior, and the actual behavior. Do not include API keys, passwords, access tokens, or private user information.

---

## Troubleshooting

### The Frontend Cannot Reach the Backend

Check that:

- The backend is running.
- The frontend API URL is correct.
- CORS permits the frontend origin.
- The deployed backend is reachable.
- Browser developer tools do not show network errors.

Do not use `http://localhost:3001` as the production API URL. In a deployed browser session, `localhost` refers to the user's own device.

### AI Responses Fail

Check that:

- The Gemini API key is configured on the backend.
- The configured model is available to the account.
- The backend logs contain no configuration errors.
- API quotas and rate limits have not been exceeded.
- The backend can reach the AI service.

Never share the API key when asking for help.

### Authentication Redirects Fail

Check the Supabase site URL, allowed redirect URLs, and the redirect configuration of the selected OAuth provider.

Make sure the deployed domain matches the configured URLs.

### File Uploads Fail

Check the supported file types, configured size limits, request-body limits, and backend logs. A large file may fail before the application reaches its file-processing code.

### Production Build Warnings

Vite may warn when a generated JavaScript bundle is large. A warning does not necessarily mean the build failed. Code splitting and lazy loading may improve load performance.

### Environment Variables Do Not Take Effect

Restart local development servers after changing environment variables. For Vite variables, rebuild or redeploy the frontend after changing production configuration.

Confirm that each variable name matches the one used in the source code.

---

## License

No open-source license is specified by this README.

Until a license is selected and added to the repository, do not assume that others have permission to redistribute, modify, or commercially use the project's code.

If you intend to open-source MIVCHAT, choose a license that matches your goals and add the corresponding `LICENSE` file.

---

## Acknowledgements

MIVCHAT builds on the work of the open-source ecosystem and the services that make modern web development possible, including React, Vite, Express, Supabase, and the libraries used for Markdown, code highlighting, mathematical rendering, document processing, and interface icons.

Thanks to everyone who tests the application, shares feedback, reports issues, and contributes ideas.

---

**MIVCHAT — Think. Create. Code. Build.**

*An evolving AI-powered workspace for learning, coding, and turning ideas into digital experiences.*