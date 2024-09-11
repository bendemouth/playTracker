const express = require('express');
const session = require('express-session');
const sql = require('mssql');
const msal = require('@azure/msal-node');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const https = require('https');
const fs = require('fs');
require('dotenv').config();



const app = express();
const port = 25662; //443 HTTPS or 25662 node.js dedicated port

// Serve files from 'public' folder
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: 'https://pell-city.bestfitsportsdata.com',
  credentials: true,
  methods: 'GET, POST, PUT, DELETE, OPTIONS'
 })); // Enable CORS for domain

// Set up SSL
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'pell-city.bestfitsportsdata.com.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'pell-city.bestfitsportsdata.com.cert')),
  ca: fs.readFileSync(path.join(__dirname, 'ssl', 'pell-city.bestfitsportsdata.com.ca')),
};

// Configure session for storing tokens
app.use(session({
  secret: process.env.SESSION_SECRET || 'o(VqTG.n^2^Cz>j-G/j-i9:kAD0[6]',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    httpOnly: true
   }  // Change false if on http
}));

// MSAL configuration for Authorization Code Flow with PKCE
const msalConfig = {
  auth: {
    clientId: config.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${config.AZURE_TENANT_ID}`,
    clientSecret: config.AZURE_CLIENT_SECRET,
    redirectUri: 'https://pell-city.bestfitsportsdata.com/callback',  
  },
  system: {
    loggerOptions: {
      loggerCallback(logLevel, message, containsPii) {
        if (logLevel === msal.LogLevel.Error || logLevel === msal.LogLevel.Warning) {
          console.log(message);  // Only log errors and warnings
        }
      },
      piiLoggingEnabled: false,  
      logLevel: msal.LogLevel.Warning  // Set log level to Warning to reduce log output. Change to verbose to see all
    }
  }
};


const cca = new msal.ConfidentialClientApplication(msalConfig);

async function connectToDatabaseWithServicePrincipal() {
  try {
    const token = await getServicePrincipalToken();  // No req needed here

    const dbConfig = {
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: token }
      },
      options: {
        encrypt: true
      }
    };

    const pool = await sql.connect(dbConfig);
    console.log('Connected to the Azure SQL Database with a service principal.');

    // Test the connection with a simple query
    const result = await pool.request().query('SELECT 1 AS number');
    console.log('Query result:', result.recordset);

  } catch (err) {
    console.error('Database connection failed:', err);
  }
}



async function getServicePrincipalToken() {
  const tokenRequest = {
    scopes: ["https://database.windows.net/.default"],  // SQL-specific scopes
  };

  try {
    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    console.log("Access Token:", response.accessToken);
    return response.accessToken;
  } catch (error) {
    console.error("Failed to acquire token:", error);
    throw error;
  }
}

// Middleware to check token expiration and refresh if necessary
app.use(async (req, res, next) => {
  const tokenExpiryBuffer = 5 * 60 * 1000;  // 5 minutes buffer before actual expiry

  if (req.session.tokenExpiry && Date.now() >= req.session.tokenExpiry - tokenExpiryBuffer) {
    console.log('Token nearing expiry, attempting to refresh...');
    try {
      await refreshAccessToken(req.session.refreshToken, req);
      console.log('Token refreshed successfully.');
    } catch (error) {
      console.log('Failed to refresh token:', error);
      return res.redirect('/msalLogin');  // Redirect to login if refresh fails
    }
  }
  next();
});

// Start the HTTPS server
https.createServer(sslOptions, app).listen(port, '0.0.0.0', async () => {
  console.log(`HTTPS Server running on port ${port}`);

  try {
    await connectToDatabaseWithServicePrincipal();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  }
});


// OAuth2 Login Route - Redirect to Azure AD for login
app.get('/msalLogin', (req, res) => {
  const authCodeUrlParameters = {
    scopes: ["openid", "profile", "offline_access", "https://graph.microsoft.com/User.Read"],
    redirectUri: "https://pell-city.bestfitsportsdata.com/callback",
    prompt: "consent"
  };

  cca.getAuthCodeUrl(authCodeUrlParameters)
    .then((response) => {
      res.redirect(response);  // Redirect user to Microsoft login page
    })
    .catch((error) => {
      console.log('Error generating auth code URL:', error);
      res.status(500).send('Error initiating login.');
    });
});

// OAuth2 Callback Route - Handle response from Azure AD
app.get('/callback', (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ["openid", "profile", "offline_access", "https://graph.microsoft.com/User.Read"],
    redirectUri: "https://pell-city.bestfitsportsdata.com/callback",
  };

  cca.acquireTokenByCode(tokenRequest)
    .then((response) => {
      console.log("Response: ",JSON.stringify(response, null, 2));
      req.session.accessToken = response.accessToken;
      req.session.refreshToken = response.refreshToken || 'No token received'; //Add debugging to check for undefined token object
      req.session.tokenExpiry = new Date(response.expiresOn).getTime();
      res.redirect('/homepage.html');  // Redirect to app homepage
      //Log access and refresh tokens
      console.log("Access token: ", response.accessToken);
      console.log("Refresh token: ", response.refreshToken);
    })
    .catch((error) => {
      console.log(JSON.stringify(error));
      res.status(500).send("Error acquiring tokens");
    });
});

// Function to refresh access token
async function refreshAccessToken(refreshToken, req) {
  if (!refreshToken) {
    throw new Error('No refresh token available. User needs to log in.');
  }

  try {
    const refreshTokenRequest = {
      refreshToken: refreshToken,
      scopes: ["openid", "profile", "offline_access", "https://graph.microsoft.com/User.Read", "https://database.windows.net/.default"],
    };

    // Refresh the token using MSAL's acquireTokenByRefreshToken
    const refreshResponse = await cca.acquireTokenByRefreshToken(refreshTokenRequest);

    // Store the new access token and expiry time in the session
    req.session.accessToken = refreshResponse.accessToken;
    req.session.tokenExpiry = new Date(refreshResponse.expiresOn).getTime();

    console.log('Access token refreshed successfully.');
  } catch (error) {
    console.error('Error refreshing token:', error);

    // If token refresh fails, force the user to log in again
    throw new Error('Token refresh failed. User needs to log in.');
  }
}


// Function to connect to the database
async function connectToDatabase(req) {
  // Check if there's a valid access token in the session
  if (!req.session || !req.session.accessToken) {
    throw new Error('No access token available. User needs to log in.');
  }

  // Check if the token is nearing expiration and refresh it if necessary
  const tokenExpiryBuffer = 5 * 60 * 1000;  // 5 minutes buffer before expiry
  if (req.session.tokenExpiry && Date.now() >= req.session.tokenExpiry - tokenExpiryBuffer) {
    console.log('Access token nearing expiry, attempting to refresh...');
    await refreshAccessToken(req.session.refreshToken, req);
  }

  // Proceed with the database connection using the (refreshed) token
  try {
    const dbConfig = {
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: req.session.accessToken }
      },
      options: {
        encrypt: true,  // Keep connection alive
        connectTimeout: 30000  // Optional: 30 seconds timeout for database connection
      }
    };

    const pool = await sql.connect(dbConfig);
    console.log('Connected to the Azure SQL Database.');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    

  //Clear session
  if (error.code === 'ELOGIN') {
    console.log('Clearing session');
    req.session.destroy(() => res.redirect('/msalLogin'));
  }
  throw err;
  }
}


// Add API route to connect to the database
app.get('/connect', async (req, res) => {
  // Check if the session and access token are available
  if (!req.session || !req.session.accessToken) {
    return res.status(401).send('User not authenticated. Please login.');
  }

  // Optional: Log the refresh token for debugging
  if (req.session.refreshToken) {
    console.log('Current Refresh Token:', req.session.refreshToken);
  } else {
    console.log('No refresh token found in the session.');
  }

  try {
    // Attempt to connect to the database using the current access token
    await connectToDatabase(req.session.accessToken);
    res.redirect('/homepage.html');
  } catch (error) {
    if (error.code === 'ELOGIN' || error.errorCode === 'invalid_grant') {
      // Handle expired or invalid tokens by redirecting to the login page
      console.log('Access token invalid or expired, redirecting to login...');
      res.redirect('/msalLogin');
    } else {
      // Handle other database connection errors
      console.error('Database connection failed:', error);
      res.status(500).send('Database connection failed');
    }
  }
});


// Add API route to POST plays to the database
app.post('/api/plays', async (req, res) => {
  try {
    // Use the centralized connectToDatabase function to handle token checks and connection setup
    const pool = await connectToDatabase(req);

    // Prepare and execute the query to insert play data
    const query = `
      INSERT INTO PellCityBoys2425 
      ([play-number], [play-situation], [players-involved], [play-action], [play-result])
      VALUES (@playNumber, @playSituation, @playersInvolved, @playAction, @playResult)
    `;

    await pool.request()
      .input('playNumber', sql.Int, req.body.playNumber)
      .input('playSituation', sql.NVarChar, req.body.playSituation)
      .input('playersInvolved', sql.NVarChar, JSON.stringify(req.body.players))  // Convert array to JSON string
      .input('playAction', sql.NVarChar, req.body.playAction)
      .input('playResult', sql.NVarChar, req.body.playResult)
      .query(query);

    res.status(200).json({ message: 'Play added successfully!' });
  } catch (err) {
    if (err.message.includes('No access token available')) {
      return res.status(401).json({ message: 'User not authenticated. Please login.' });
    } else if (err.code === 'ELOGIN') {
      console.log('Access token invalid or expired, redirecting to login...');
      return res.status(401).json({ message: 'Access token invalid or expired, please login again.' });
    } else {
      console.error('Error inserting play:', err);
      return res.status(500).json({ message: 'Database insert failed.' });
    }
  }
});

// Check if token is expired
const checkTokenExpiry = async (req, res, next) => {

  if (!req.session || !req.session.accessToken) {
    console.log('No access token available. Redirecting to login...');
    return res.redirect('/msalLogin');
  }

  const tokenExpiryBuffer = 5 * 60 * 1000;  // 5 minutes buffer before expiry
  if (Date.now() >= req.session.tokenExpiry - tokenExpiryBuffer) {
    console.log('Token expired. Attempting to refresh...');

    // No refresh token, force user to log in again
    if (!req.session.refreshToken || req.session.refreshToken === 'No refresh token received') {
      return res.redirect('/msalLogin');
    }

    try {
      // Use refresh token to acquire new tokens
      const refreshTokenRequest = {
        refreshToken: req.session.refreshToken,
        scopes: ["openid", "profile", "offline_access", "https://graph.microsoft.com/User.Read", "https://database.windows.net/.default"],
      };

      const refreshResponse = await cca.acquireTokenByRefreshToken(refreshTokenRequest);

      // Store new access token and expiration
      req.session.accessToken = refreshResponse.accessToken;
      req.session.tokenExpiry = new Date(refreshResponse.expiresOn).getTime();

      console.log('Token successfully refreshed.');

      next();  // Proceed to next middleware/route
    } catch (error) {
      console.error('Error refreshing token:', error);
      return res.redirect('/msalLogin');  // Redirect to login if refresh fails
    }
  } else {
    next();  // Token is still valid, proceed
  }
};

// Add API route to GET play data from the database
app.get('/api/plays', checkTokenExpiry, async (req, res) => {
  try {
    const pool = await connectToDatabase(req);
    const result = await pool.request().query('SELECT * FROM PellCityBoys2425');
    res.status(200).json(result.recordset);
  } catch (err) {
    if (err.message.includes('No access token available')) {
      // Return 401 Unauthorized instead of redirecting
      return res.status(401).json({ message: 'User not authenticated. Please login.' });
    } else if (err.code === 'ELOGIN') {
      console.log('Access token invalid or expired, returning 401...');
      // Return 401 Unauthorized instead of redirecting
      return res.status(401).json({ message: 'Access token invalid or expired. Please login again.' });
    } else {
      console.error('Database retrieval failed:', err);
      return res.status(500).send('Database retrieval failed');
    }
  }
});


// Add API route to delete the most recent play from the database
app.delete('/api/plays', async (req, res) => {
  try {
    // Use the centralized connectToDatabase function to handle token checks and connection setup
    const pool = await connectToDatabase(req);

    // Define the query to delete the most recent play
    const query = `
      DELETE FROM PellCityBoys2425
      WHERE [play-id] = (
          SELECT TOP 1 [play-id]
          FROM PellCityBoys2425
          ORDER BY [play-id] DESC
      );
    `;

    // Execute the query
    await pool.request().query(query);

    res.status(200).json({ message: 'Most recent play deleted successfully' });
  } catch (err) {
    if (err.message.includes('No access token available')) {
      return res.status(401).json({ message: 'User not authenticated. Please login.' });
    } else if (err.code === 'ELOGIN') {
      console.log('Access token invalid or expired, redirecting to login...');
      return res.status(401).json({ message: 'Access token invalid or expired, please login again.' });
    } else {
      console.error('Error deleting the most recent play:', err);
      return res.status(500).json({ message: 'Failed to delete the most recent play.' });
    }
  }
});

//Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log('Error destroying session:', err);
      return res.status(500).send('Failed to log out.');
    }
    sql.close();
    console.log('Database connection pool closed.');  // Close the database connection pool
    res.redirect('/msalLogin');
  });
});

//Setup '/sqlLogin' route
app.get('/sqlLogin', (req, res) => {
  // Set a flag indicating that this login is for SQL access
  req.session.isSQLLogin = true;

  const authCodeUrlParameters = {
    scopes: ["https://database.windows.net/.default"],
    redirectUri: "https://pell-city.bestfitsportsdata.com/callback",
    prompt: "consent"
  };

  cca.getAuthCodeUrl(authCodeUrlParameters)
    .then((response) => res.redirect(response))
    .catch((error) => {
      console.error('Error generating SQL auth URL:', error);
      res.status(500).send('Failed to generate SQL authentication URL.');
    });
});


//Setup and manage '/callback' route
app.get('/callback', async (req, res) => {
  // Extract authorization code from query parameters
  const authCode = req.query.code;
  
  if (!authCode) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    // Token request parameters with combined scopes for both SQL and Graph API access
    const tokenRequest = {
      code: authCode,
      scopes: [
        "openid", 
        "profile", 
        "offline_access",  // Ensures refresh tokens are granted
        "https://graph.microsoft.com/User.Read",  // For Graph API access
        "https://database.windows.net/.default"  // For Azure SQL Database access
      ],
      redirectUri: "https://pell-city.bestfitsportsdata.com/callback"
    };

    // Exchange authorization code for access token
    const tokenResponse = await cca.acquireTokenByCode(tokenRequest);

    // Store the access and refresh tokens in the session
    req.session.accessToken = tokenResponse.accessToken;
    req.session.refreshToken = tokenResponse.refreshToken || 'No refresh token received';  // Add debugging info
    req.session.tokenExpiry = new Date(tokenResponse.expiresOn).getTime();

    console.log('Access token:', tokenResponse.accessToken);
    console.log('Refresh token:', req.session.refreshToken);  // Debugging

    // Redirect to the homepage or any other route
    res.redirect('/homepage.html');
  } catch (error) {
    console.error('Error acquiring token:', error);
    res.status(500).send('Error during token exchange.');
  }
});



