# Vercel Deployment Guide

## Environment Variables Setup

To deploy this application to Vercel, you need to configure the following environment variables in your Vercel dashboard:

### Required Environment Variables

1. **VITE_SUPABASE_URL**
   - Value: `https://evkttwkermhcyizywzpe.supabase.co`
   - Description: Your Supabase project URL

2. **VITE_SUPABASE_ANON_KEY**
   - Value: Your Supabase anonymous key (get from Supabase dashboard)
   - Description: Public API key for Supabase client

3. **VITE_ADMIN_USER_ID**
   - Value: Your admin user UUID
   - Description: Admin user identifier for role-based access

4. **VITE_APP_URL**
   - Value: `https://your-app-name.vercel.app`
   - Description: Production URL of your deployed app

### Optional Environment Variables

5. **VITE_GOOGLE_CLIENT_ID**
   - Value: Your Google OAuth client ID
   - Description: For Google Sign-in functionality (if enabled)

## How to Set Environment Variables in Vercel

### Method 1: Vercel Dashboard
1. Go to your project in Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with its value
4. Select the environments (Production, Preview, Development)
5. Click "Save"

### Method 2: Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_ADMIN_USER_ID
vercel env add VITE_APP_URL
```

### Method 3: vercel.json Configuration
You can also create a `vercel.json` file (but don't include sensitive values):

```json
{
  "env": {
    "VITE_SUPABASE_URL": "@supabase-url",
    "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "VITE_ADMIN_USER_ID": "@admin-user-id",
    "VITE_APP_URL": "@app-url"
  }
}
```

## Security Best Practices

1. ✅ Never commit `.env` files to Git
2. ✅ Use `.env.example` for documentation
3. ✅ Set environment variables in Vercel dashboard
4. ✅ Use different keys for development and production
5. ✅ Regularly rotate API keys

## Deployment Steps

1. Ensure all environment variables are set in Vercel
2. Push your code to GitHub (without .env file)
3. Vercel will automatically deploy using the environment variables
4. Test the deployed application

## Troubleshooting

If images don't load in production:
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set
- Verify Supabase storage bucket is public
- Check browser console for any CORS or authentication errors 