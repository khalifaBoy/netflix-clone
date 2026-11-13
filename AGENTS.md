# Project: Netflix Clone

## 1. Project Overview
Build and maintain a full-stack Netflix-like streaming platform.

## 2. Technology Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Multer

## 3. Architecture
- Maintain separate frontend and backend applications.
- Follow modular architecture.
- Keep controllers, routes, models and middleware separate.
- Use reusable frontend components.
- Maintain separation between business logic and presentation.

## 4. Coding Standards
- Use clean, readable and maintainable code.
- Avoid unnecessary dependencies.
- Use proper error handling.
- Validate all user inputs.
- Follow REST API conventions.
- Use environment variables for secrets.
- Never expose credentials.

## 5. Frontend Guidelines
- Use reusable React components.
- Prefer Server Components where appropriate.
- Use Client Components for interactive features.
- Maintain responsive layouts.
- Implement proper loading and error states.
- Optimize images and video delivery.

## 6. Backend Guidelines
- Follow REST API architecture.
- Validate requests.
- Implement secure authentication and authorization.
- Use proper HTTP status codes.
- Handle database errors.
- Protect sensitive routes.
- Never trust client-provided user IDs for authorization.

## 7. Security
- Hash passwords.
- Validate JWT tokens.
- Implement role-based authorization where needed.
- Prevent unauthorized file uploads.
- Validate file types and sizes.
- Protect against NoSQL injection and XSS.
- Never expose API keys.

## 8. Development Workflow
Before implementation:
1. Analyze existing code.
2. Understand dependencies.
3. Identify affected files.
4. Create an implementation plan.

After implementation:
1. Run frontend checks.
2. Run backend checks.
3. Test API endpoints.
4. Fix errors.
5. Explain modifications.

## 9. Important Rules
- Preserve existing functionality.
- Do not rewrite the entire application unnecessarily.
- Do not delete existing features without permission.
- Do not invent functionality that is not requested.
- Ask before making major architectural changes.
- Do not commit or push without permission.