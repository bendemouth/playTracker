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
const axios = require('axios');
const crypto = require('crypto');

// Helper functions
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

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
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true } //Set false if HTTP instead of HTTPS
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

// Start the HTTPS server
https.createServer(sslOptions, app).listen(port, '0.0.0.0', async () => {
  console.log(`HTTPS Server running on port ${port}`);

  try {
    await connectToDatabase();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  }
});

// Function to refresh access token
async function refreshAccessToken(req) {
  try {
    const account = req.session.account;  // Retrieve account info from session

    if (account && req.session.refreshToken) {
      console.log('Using refresh token to acquire new access token.');

      const refreshTokenRequest = {
        refreshToken: req.session.refreshToken,
        scopes: ["openid profile offline_access https://graph.microsoft.com/User.Read"]
      };

      const refreshResponse = await cca.acquireTokenByRefreshToken(refreshTokenRequest);

      console.log(refreshResponse);

      // Update session with new access token and refresh token
      req.session.accessToken = refreshResponse.accessToken;
      req.session.refreshToken = refreshResponse.refreshToken || req.session.refreshToken;
      req.session.tokenExpiry = refreshResponse.exp * 1000; 

      console.log("Token successfully refreshed using refresh token.");
      console.log("Token Expires at:", req.session.tokenExpiry);
    } else {
      throw new Error('No refresh token available. User needs to log in.');
    }
  } catch (error) {
    console.error('Failed to refresh token:', error);
    throw new Error('Token refresh failed. User needs to log in.');
  }
}



//Middleware to check token and refresh if needed
async function checkTokenExpiry(req, res, next) {
  
  console.log('Current time:', Date.now());
  console.log('Token expiry:', req.session.tokenExpiry);

  const tokenExpiryBuffer = 5 * 60 * 1000;  // 5-minute buffer before actual expiration
  try {
    if (!req.session.accessToken || Date.now() >= req.session.tokenExpiry - tokenExpiryBuffer) {
      console.log('Token is expired or near expiry. Refreshing token...');
      await refreshAccessToken(req);  // Refresh or acquire new token
    }
    next();  // Proceed to the next middleware or route
  } catch (error) {
    console.error('Error during token refresh:', error);
    return res.status(401).send('Token expired or invalid. Please log in again.');
  }
}


// Function to connect to the database
let poolPromise = null;
let servicePrincipalToken = null;
let tokenExpiry = null;  

async function connectToDatabase() {
  const tokenExpiryBuffer = 5 * 60 * 1000; 

  // Check if the token is expired or about to expire
  if (!servicePrincipalToken || !tokenExpiry || Date.now() >= tokenExpiry - tokenExpiryBuffer) {
    console.log("Token is expired, about to expire, or doesn't exist. Acquiring new token...");
    
    try {
      // Acquire a new service principal token
      servicePrincipalToken = await getServicePrincipalToken();
      tokenExpiry = Date.now() + (60 * 60 * 1000); 
      console.log("New token acquired. Expires at:", new Date(tokenExpiry));

      // Reset connection pool to use the new token
      if (poolPromise) {
        console.log("Closing existing connection pool to refresh token.");
        const pool = await poolPromise; 
        await pool.close();  
        poolPromise = null; // Reset pool promise so a new one is created
      }
    } catch (error) {
      console.error("Failed to acquire new token:", error);
      throw error; 
    }
  }

  // Create a new connection pool if it doesn't exist
  if (!poolPromise) {
    try {
      const dbConfig = {
        server: config.DB_SERVER,
        database: config.DB_DATABASE,
        authentication: {
          type: 'azure-active-directory-access-token',
          options: { token: servicePrincipalToken } 
        },
        options: {
          encrypt: true,  
          connectTimeout: 30000
        }
      };

      poolPromise = sql.connect(dbConfig); // Create the new connection pool promise
      console.log('Connected to the Azure SQL Database using service principal.');
    } catch (err) {
      console.error('Database connection failed:', err);
      if (err.code === 'ELOGIN') {
        console.log('Invalid or expired service principal token.');
      }
      throw err;
    }
  }

  return poolPromise; 
}




async function getToken(req) {
  const tokenRequestBody = {
    client_id: config.AZURE_CLIENT_ID,
    scope: 'openid profile offline_access https://graph.microsoft.com/User.Read',
    code: req.query.code,
    redirect_uri: config.REDIRECT_URI,
    grant_type: 'authorization_code',
    client_secret: config.AZURE_CLIENT_SECRET,
    code_verifier: req.session.codeVerifier
  };

  try {
    const response = await axios.post(`https://login.microsoftonline.com/${config.AZURE_TENANT_ID}/oauth2/v2.0/token`, new URLSearchParams(tokenRequestBody).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Store tokens in the session
    req.session.accessToken = response.data.access_token;
    req.session.refreshToken = response.data.refresh_token;  // Ensure refresh token is stored
    req.session.tokenExpiry = response.data.exp * 1000;  // Calculate expiry time

    console.log('Access Token:', response.data.access_token);
    console.log('Refresh Token:', response.data.refresh_token);
    console.log('Token Expires at:', req.session.tokenExpiry);

    return response.data;
  } catch (error) {
    console.error('Error fetching token:', error.response.data);
    throw error;
  }
}


async function getServicePrincipalToken() {
  const tokenRequest = {
    scopes: ["https://database.windows.net/.default"],  // Scope for Azure SQL Database
  };

  try {
    // MSAL's acquireTokenByClientCredential will fetch a token for the service principal
    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    console.log("Access Token acquired using Service Principal:", response.accessToken);
    return response.accessToken;
  } catch (error) {
    console.error("Failed to acquire token using Service Principal:", error);
    throw error;
  }
}

async function connectToDatabaseWithServicePrincipal() {
  try {
    const accessToken = await getServicePrincipalToken();  // Get token using service principal

    const dbConfig = {
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: accessToken }
      },
      options: {
        encrypt: true,
        connectTimeout: 30000
      }
    };

    const pool = await sql.connect(dbConfig);
    console.log('Connected to the Azure SQL Database.');
    return pool;
  } catch (err) {
    console.error('Database connection failed at startup:', err);
    throw err;
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
      return res.redirect('index.html');  // Redirect to login if refresh fails
    }
  }
  next();
});

// OAuth2 Login Route - Redirect to Azure AD for login
app.get('/msalLogin', (req, res) => {

    //Get codes for PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    req.session.codeVerifier = codeVerifier; // Store code verifier in session

  // Logic check for SQL or Graph API access
  const isSQLLogin = req.session.isSQLLogin;
  const authCodeUrlParameters = {
    scopes: isSQLLogin
      ? ["https://database.windows.net/.default"]  // For Azure SQL Database access
      : ["openid profile offline_access https://graph.microsoft.com/User.Read"],  // For Graph API access
    redirectUri: "https://pell-city.bestfitsportsdata.com/callback",
    prompt: "consent",
    codeChallenge: codeChallenge,
    codeChallengeMethod: "S256",
    responseMode: "query"
  };

  cca.getAuthCodeUrl(authCodeUrlParameters)
    .then((response) => res.redirect(response))
    .catch((error) => {
      console.error('Error generating auth code URL:', error);
      res.status(500).send('Error initiating login.');
    });
});


// Add API route to POST plays to the database
app.post('/api/plays', checkTokenExpiry, async (req, res) => {
  try {
    const pool = await connectToDatabase();

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

// Add API route to GET play data from the database
app.get('/api/plays', checkTokenExpiry, async (req, res) => {
  try {
    console.log("Session Data: ", req.session);  // Log session details for debugging

    const pool = await connectToDatabase();  // Attempt to connect to the database
    const query = `SELECT * FROM PellCityBoys2425`;
    const result = await pool.request().query(query);
    
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error in /api/plays route:', err);
    if (err.message.includes('No access token available')) {
      return res.status(401).json({ message: 'User not authenticated. Please log in.' });
    } else if (err.code === 'ELOGIN') {
      console.log('Access token invalid or expired, redirecting to login...');
      return res.status(401).json({ message: 'Access token invalid or expired. Please log in again.' });
    } else {
      console.error('Database retrieval failed:', err);
      return res.status(500).send('Error accessing database');
    }
  }
});

// Add API route to delete the most recent play from the database
app.delete('/api/plays', checkTokenExpiry, async (req, res) => {
  try {
    // Use the centralized connectToDatabase function to handle token checks and connection setup
    const pool = await connectToDatabase();

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
  // Clear session data
  req.session.accessToken = null;
  req.session.refreshToken = null;
  req.session.tokenExpiry = null;

  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out.');
    }
    res.redirect('/index.html');
  });
});

//Setup and manage '/callback' route
app.get('/callback', async (req, res) => {
  const authCode = req.query.code;

  console.log("Authorization code:", authCode);

  if (!authCode) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    // Call getToken to exchange the auth code for tokens
    const tokenResponse = await getToken(req);
    const account = parseJwt(tokenResponse.id_token);

    // Store the access and refresh tokens in session
    req.session.accessToken = tokenResponse.access_token;
    req.session.refreshToken = tokenResponse.refresh_token;
    req.session.account = account;

    console.log("User Account Info:", account);

    // Use exp because it is epoch time
    req.session.tokenExpiry = tokenResponse * 1000; // Convert to timestamp

    console.log("Token Expires at:", req.session.tokenExpiry);

    res.redirect('/homepage.html');
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.status(500).send('Error during token exchange.');
  }
});