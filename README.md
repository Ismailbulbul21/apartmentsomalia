# Somalia Apartments Platform

A modern apartment rental platform built with React, Vite, Tailwind CSS, and Supabase. Features user authentication, apartment listings, reviews, and role-based access control.

## Features

- 🏠 **Apartment Listings**: Browse and search apartments
- 👤 **User Authentication**: Email/password and Google OAuth sign-in
- 📝 **Reviews & Ratings**: User reviews for apartments
- 🏢 **Owner Dashboard**: Property management for owners
- 👑 **Admin Panel**: Administrative controls
- 📱 **Responsive Design**: Mobile-first design with Tailwind CSS
- 🔒 **Role-based Access**: User, Owner, and Admin roles

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Authentication**: Supabase Auth with Google OAuth
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS with custom night theme

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd apartmentproject
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory using the `env.template` as reference:

```bash
cp env.template .env
```

Fill in your environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Admin Configuration
VITE_ADMIN_USER_ID=your-admin-user-id

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Development URLs
VITE_APP_URL=http://localhost:5173
```

### 3. Google OAuth Setup

#### Step 1: Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google+ API
   - Google Identity Services API

#### Step 2: OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in required information:
   - App name: "Somalia Apartments"
   - User support email: your email
   - Developer contact: your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users (your email addresses)

#### Step 3: Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: "Web application"
4. Name: "Somalia Apartments Web Client"
5. Authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - Your production domain
6. Authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - `https://your-project-id.supabase.co/auth/v1/callback`
   - Your production callback URL
7. Copy the Client ID to your `.env` file

### 4. Supabase Configuration

#### Enable Google OAuth in Supabase:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Authentication → Providers
3. Enable Google provider
4. Add your Google Client ID and Client Secret
5. Set redirect URL: `https://your-project-id.supabase.co/auth/v1/callback`

### 5. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Authentication Flow

### Google Sign-in Process:
1. User clicks "Continue with Google"
2. Redirected to Google OAuth consent screen
3. After approval, redirected to `/auth/callback`
4. Callback page processes the authentication
5. User profile is created/updated in Supabase
6. User is redirected to the homepage

### Email/Password Sign-in:
1. Traditional email/password authentication
2. Email verification required for new accounts
3. Password reset functionality available

## Deployment

### Environment Variables for Production

When deploying to platforms like Vercel, Netlify, or other hosting services, make sure to set these environment variables:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ADMIN_USER_ID=your-admin-user-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_APP_URL=https://your-production-domain.com
```

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Update Google OAuth redirect URLs to include your Vercel domain
4. Deploy

### Other Platforms

For other hosting platforms:
1. Build the project: `npm run build`
2. Upload the `dist` folder to your hosting service
3. Configure environment variables in your hosting platform
4. Update OAuth redirect URLs accordingly

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── layout/         # Header, Footer, etc.
│   ├── ui/            # Reusable UI components
│   └── ...
├── context/
│   └── AuthContext.jsx # Authentication state management
├── pages/             # Route components
├── lib/
│   └── supabase.js    # Supabase client configuration
└── utils/             # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
