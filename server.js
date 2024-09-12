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
    await connectToDatabaseWithServicePrincipal();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  }
});



// Function to refresh access token
async function refreshAccessToken(req) {
  try {
      // Log the refresh token for debugging
      console.log("Refresh token in session:", req.session.refreshToken);

      if (!req.session.refreshToken) {
          throw new Error('No refresh token available. User needs to log in.');
      }

      const refreshTokenRequest = {
          refreshToken: req.session.refreshToken,
          scopes: req.session.isSQLLogin
              ? ["https://database.windows.net/.default"]  // SQL scopes
              : ["openid profile offline_access https://graph.microsoft.com/User.Read"]   // Graph API scopes
      };

      const refreshResponse = await cca.acquireTokenByRefreshToken(refreshTokenRequest);

      req.session.accessToken = refreshResponse.accessToken;
      req.session.refreshToken = refreshResponse.refreshToken || req.session.refreshToken;  // Update refresh token if a new one is issued
      req.session.tokenExpiry = new Date(refreshResponse.expiresOn).getTime();

      console.log("Token successfully refreshed!");
  } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error("Token refresh failed. User needs to log in.");
  }
}
// Check if token is expired// Middleware to check token and refresh if needed
async function checkTokenExpiry(req, res, next) {
  const tokenExpiryBuffer = 5 * 60 * 1000;  // 5 minutes buffer before actual expiry
  try {
    if (!req.session.accessToken || Date.now() >= req.session.tokenExpiry - tokenExpiryBuffer) {
      await refreshAccessToken(req);  // Refresh or acquire new token
    }
    next();
  } catch (err) {
    return res.redirect('/login');  // Redirect to login if token invalid
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

async function getToken(req) {
  const tokenRequestBody = {
    client_id: config.AZURE_CLIENT_ID,
    scope: 'openid profile offline_access https://graph.microsoft.com/User.Read',
    code: req.query.code,  // Authorization code from the request
    redirect_uri: config.REDIRECT_URI,
    grant_type: 'authorization_code',
    client_secret: config.AZURE_CLIENT_SECRET
  };

  try {
    const response = await axios.post(`https://login.microsoftonline.com/${config.AZURE_TENANT_ID}/oauth2/v2.0/token`, new URLSearchParams(tokenRequestBody).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Store the tokens (access_token, refresh_token)
    req.session.accessToken = response.data.access_token;
    req.session.refreshToken = response.data.refresh_token;
    req.session.tokenExpiry = Date.now() + (response.data.expires_in * 1000);  // Calculate expiry time

    console.log('Access Token:', response.data.access_token);
    console.log('Refresh Token:', response.data.refresh_token);

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
      return res.redirect('/msalLogin');  // Redirect to login if refresh fails
    }
  }
  next();
});



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


// OAuth2 Login Route - Redirect to Azure AD for login
app.get('/msalLogin', (req, res) => {
  // Logic check for SQL or Graph API access
  const isSQLLogin = req.session.isSQLLogin;
  const authCodeUrlParameters = {
    scopes: isSQLLogin
      ? ["https://database.windows.net/.default"]  // For Azure SQL Database access
      : ["openid profile offline_access https://graph.microsoft.com/User.Read"],  // For Graph API access
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


// Add API route to POST plays to the database
app.post('/api/plays', checkTokenExpiry, async (req, res) => {
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

// Add API route to GET play data from the database
app.get('/api/plays', checkTokenExpiry, async (req, res) => {
  try {
    //Check if token is valid
    await getToken(req);

    const pool = await connectToDatabase(req);
    const query = `SELECT 1 AS NUMBER`;
    const result = await pool.request().query(query);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Database retrieval failed:', err);
    res.status(500).send('Error accessing database');
  }
});


// Add API route to delete the most recent play from the database
app.delete('/api/plays', checkTokenExpiry,async (req, res) => {
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
  const authCode = req.query.code;

  if (!authCode) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    // Call getToken to exchange the auth code for tokens
    const tokenResponse = await getToken(req);

    // Store the access and refresh tokens in session
    req.session.accessToken = tokenResponse.access_token;
    req.session.refreshToken = tokenResponse.refresh_token;

    // MSAL uses expiresOn which is a date, so store it directly
    req.session.tokenExpiry = new Date(tokenResponse.expiresOn).getTime(); // Convert to timestamp

    res.redirect('/homepage.html');
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.status(500).send('Error during token exchange.');
  }
});