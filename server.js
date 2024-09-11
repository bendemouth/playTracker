const express = require('express');
const session = require('express-session');
const sql = require('mssql');
const msal = require('@azure/msal-node');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const https = require('https');
const fs = require('fs');

const app = express();
const port = 25662; //443 HTTPS or 25662 node.js dedicated port

// Serve files from 'public' folder
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: 'https://pell-city.bestfitsportsdata.com' })); // Enable CORS for domain

// Set up SSL
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'pell-city.bestfitsportsdata.com.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'pell-city.bestfitsportsdata.com.cert')),
  ca: fs.readFileSync(path.join(__dirname, 'ssl', 'pell-city.bestfitsportsdata.com.ca')),
};

// Configure session for storing tokens
app.use(session({
  secret: config.SESSION_SECRET|| 'o(VqTG.n^2^Cz>j-G/j-i9:kAD0[6}',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }  // Change false if on http
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
    const token = await getServicePrincipalToken();

    const dbConfig = {
      server: config.DB_SERVER,
      database: config.DB_DATABASE,                
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: token }
      },
      options: { 
        encrypt: true,
        keepAlive: true
      }
    };

    const pool = await sql.connect(dbConfig);
    console.log('Connected to the Azure SQL Database with a service principal');

    // Test the connection with a simple query
    const result = await pool.request().query('SELECT 1 AS number');
    console.log('Query result:', result.recordset);

  } catch (err) {
    console.error('Database connection failed:', err);
  }
}


async function getServicePrincipalToken() {
  const tokenRequest = {
    scopes: ["https://database.windows.net/.default"],  
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
    .then((response) => res.redirect(response))
    .catch((error) => console.log(JSON.stringify(error)));
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
  const refreshTokenRequest = {
    refreshToken: refreshToken,
    scopes: ["openid", "profile", "offline_access", "https://graph.microsoft.com/User.Read"],
  };

  try {
    const response = await cca.acquireTokenByRefreshToken(refreshTokenRequest);
    
    if (response && response.accessToken) {
      req.session.accessToken = response.accessToken;
      req.session.refreshToken = response.refreshToken || refreshToken;  // Keep old refresh token if no new one is provided
      req.session.tokenExpiry = new Date(response.expiresOn).getTime();
      console.log("Access token: ", response.accessToken);      
    } else {
      console.error("No access token in response");
      throw new Error("Failed to refresh access token");
    }
  } catch (error) {
    console.error("Failed to refresh token:", error);
    if (error.errorCode === 'invalid_grant' || error.errorCode === 'interaction_required') {
      // Clear the session and redirect to login
      req.session.destroy(() => {
        console.log("Session destroyed due to token refresh failure");
        res.redirect('/msalLogin');  // Redirect to login
      });
    } else {
      throw error;  //Throw error if needed
    }
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
        encrypt: true,
        keepAlive: true  // Keep connection alive
      }
    };

    const pool = await sql.connect(dbConfig);
    console.log('Connected to the Azure SQL Database.');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
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


// Add API route to GET play data from the database
app.get('/api/plays', async (req, res) => {
  try {
    const pool = await connectToDatabase(req);  // Use the updated connectToDatabase function
    const result = await pool.request().query('SELECT * FROM PellCityBoys2425');
    res.status(200).json(result.recordset);
  } catch (err) {
    if (err.message.includes('No access token available')) {
      return res.redirect('/msalLogin');  // Redirect to login if no token is found
    } else if (err.code === 'ELOGIN') {
      console.log('Access token invalid or expired, redirecting to login...');
      return res.redirect('/msalLogin');
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


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log('Error destroying session:', err);
      return res.status(500).send('Failed to log out.');
    }
    sql.close();  // Close the database connection pool
    res.redirect('/index.html');
  });
});