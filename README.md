# Front-End Integration Guide for Google OAuth

This document provides instructions for the front-end team to integrate with the Google OAuth 2.0 authentication flow.

## 1. Overview of the Authentication Flow

The authentication process is based on the OAuth 2.0 Authorization Code Flow. Here is the sequence of events:

1.  **User Initiates Login**: The user clicks a "Login with Google" button in the front-end application.
2.  **Redirect to Back-End**: The front-end redirects the user to a specific back-end endpoint to start the authentication process.
3.  **Back-End Redirects to Google**: The back-end redirects the user to Google's authentication page.
4.  **User Authenticates**: The user signs in with their Google account and authorizes the application.
5.  **Google Redirects to Back-End**: Google redirects the user back to a callback endpoint on the back-end, providing an authorization code.
6.  **Back-End Creates a Session**: The back-end exchanges the authorization code for a Google access token, fetches the user's profile, finds or creates a user in the database, and generates a JWT (JSON Web Token) for the user.
7.  **Back-End Redirects to Front-End**: The back-end redirects the user to a specific callback page on the front-end, attaching the JWT as a query parameter.
8.  **Front-End Completes Login**: The front-end callback page extracts the JWT from the URL, stores it securely (e.g., in `localStorage`), and redirects the user to their dashboard or the appropriate page.

## 2. Front-End Implementation Steps

### Step 1: Create the "Login with Google" Button

Create a button or link that directs the user to the back-end's authentication endpoint.

*   **URL**: `/api/users/auth/google`

For example, in an HTML anchor tag:

```html
<a href="http://localhost:5000/api/users/auth/google">Login with Google</a>
```

> **Note**: Replace `http://localhost:5000` with your actual back-end server address in a production environment.

### Step 2: Create a Callback Page

You need to create a new page or route in your front-end application to handle the callback from the back-end.

*   **Recommended Route**: `/auth/callback`

The back-end will redirect the user to this page after a successful authentication. The URL will look like this:

`http://your-frontend-domain.com/auth/callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 3: Handle the Callback

On your `/auth/callback` page, you need to:

1.  **Extract the Token**: Get the `token` from the URL's query parameters.
2.  **Store the Token**: Store the token in a secure place, such as `localStorage`.
3.  **Redirect the User**: Redirect the user to a protected page, like their dashboard.

Here is a sample implementation in a React component:

```javascript
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');

    if (token) {
      // Store the token
      localStorage.setItem('jwt_token', token);

      // Redirect to the dashboard or home page
      navigate('/dashboard');
    } else {
      // Handle the case where the token is not present
      console.error('Authentication failed: No token provided.');
      navigate('/login');
    }
  }, [location, navigate]);

  return (
    <div>
      <p>Loading...</p>
    </div>
  );
};

export default AuthCallback;
```

### Step 4: Send the Token with API Requests

For all subsequent requests to protected back-end endpoints, you must include the JWT in the `Authorization` header.

```
Authorization: Bearer <your_jwt_token>
```

Here's an example using `axios`:

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Now you can use apiClient to make authenticated requests
// For example:
// apiClient.get('/users/profile');
```

## 3. Environment Variables

The back-end relies on an environment variable to know where to redirect the user. Make sure the following variable is set in the back-end's `.env` file:

*   `FRONTEND_URL`: The base URL of your front-end application.

**Example `.env` file for the back-end:**

```
# The full URL of the front-end application
FRONTEND_URL=http://localhost:5173
```

If this variable is not set, the back-end will default to `http://localhost:5173`.
