# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a React project management application for construction consulting and supervision companies. The project uses:
- React 18 with Vite for fast development
- Tailwind CSS for modern, responsive UI design
- Supabase for backend services (PostgreSQL, Auth, Storage)
- React Router for navigation
- Times New Roman as the default font (Vietnamese professional standard)

## Key Features
- User authentication with role-based access (Manager, Admin, User)
- Project management with task assignments
- Real-time notifications via email and push notifications
- Advanced filtering and multi-row/column editing
- Excel import/export functionality
- Voice input for task descriptions
- Vietnamese text recognition from documents/images
- Birthday and anniversary reminders
- Progress tracking with visual indicators

## Code Style Guidelines
- Use functional components with hooks
- Implement proper TypeScript-like prop validation with JSDoc
- Follow Vietnamese naming conventions for user-facing text
- Use Tailwind CSS utility classes instead of custom CSS
- Implement proper error handling and loading states
- Ensure responsive design for mobile and desktop
- Use proper semantic HTML elements

## Database Schema
The application uses Supabase with PostgreSQL. Key tables include:
- `profiles` - User information extending auth.users
- `projects` - Project information with status tracking
- `project_members` - Many-to-many relationship between users and projects
- `tasks` - Task management with status, progress, and assignments
- `notifications` - System notifications for users

## Security Considerations
- Implement Row Level Security (RLS) policies
- Validate all user inputs
- Use proper authentication checks
- Implement proper role-based access control
- Sanitize data before database operations
