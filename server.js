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
app.use(cors({ origin: 'http://pell-city.bestfitsportsdata.com' })); // Enable CORS for domain

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
  },
  cache: {
    cacheLocation: "sessionStorage",  
    storeAuthStateInCookie: true  
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
  if (req.session.tokenExpiry && Date.now() >= req.session.tokenExpiry) {
    console.log('Token expired, attempting to refresh...');
    try {
      await refreshAccessToken(req.session.refreshToken, req);
      console.log('Token refreshed successfully.');
    } catch (error) {
      console.log('Failed to refresh token:', error);
      return res.redirect('/msalLogin');  // Redirect to login);
    }
  }
  next();
});

// Start the HTTPS server
https.createServer(sslOptions, app).listen(port, '0.0.0.0', async () => {
  console.log(`HTTPS Server running on port ${port}`);

  try {
    const servicePrincipalToken = await getServicePrincipalToken();
    await connectToDatabase(servicePrincipalToken);  // Use the service principal token
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
async function connectToDatabase(token) {
  try {
    const dbConfig = {
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: token || config.DEFAULT_DB_TOKEN }  // Use a default token if no token is provided
      },
      options: { encrypt: true,
                 keepAlive: true
       }  // Required true for Azure SQL
    };

    const pool = await sql.connect(dbConfig);
    console.log('Connected to the Azure SQL Database with Azure AD');

    // Test the connection with a simple query
    const result = await pool.request().query('SELECT 1 AS number');
    console.log('Query result:', result.recordset);

  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Full error details:', err);
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
    const pool = await sql.connect({
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: req.session.accessToken }
      },
      options: { encrypt: true }
    });

    const query = `
      INSERT INTO PellCityBoys2425 
      ([play-number], [play-situation], [players-involved], [play-action], [play-result], [opponent])
      VALUES (@playNumber, @playSituation, @playersInvolved, @playAction, @playResult, @opponent)
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
    console.error('Error inserting play:', err);
    res.status(500).json({ message: 'Database insert failed.' });
  }
});

// Add API route to GET play data from the database
app.get('/api/plays', async (req, res) => {
  try {
    const pool = await sql.connect({
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: req.session.accessToken }
      },
      options: { encrypt: true }
    });
    const result = await pool.request().query('SELECT * FROM PellCityBoys2425');

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error('Error retrieving plays:', err);
    res.status(500).json({ message: 'Database retrieval failed.' });
  }
});

// Add API route to check user login information
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await sql.connect();

    // Query the database for the provided username and password
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, password)
      .query('SELECT * FROM LoginInfo WHERE username = @username AND password = @password');

    if (result.recordset.length > 0) {
      // User exists, proceed with OAuth flow
      const authCodeUrlParameters = {
        scopes: ["openid", "profile", "offline_access", "https://graph.microsoft.com/User.Read"],
        redirectUri: "https://pell-city.bestfitsportsdata.com/callback",
        prompt: "consent"
      };

      // Redirect the user to the Microsoft login page
      cca.getAuthCodeUrl(authCodeUrlParameters)
        .then((response) => {
          res.redirect(response);
        })
        .catch((error) => {
          console.log(JSON.stringify(error));
          res.status(500).send("Error redirecting to Microsoft login");
        });

    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Database retrieval failed.' });
  }
});


// Add API route to delete the most recent play from the database
app.delete('/api/plays', async (req, res) => {
  try {
    const pool = await sql.connect({
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: req.session.accessToken }
      },
      options: { encrypt: true }
    });

    const query = `
      DELETE FROM PellCityBoys2425
      WHERE [play-id] = (
          SELECT TOP 1 [play-id]
          FROM PellCityBoys2425
          ORDER BY [play-id] DESC
      );
    `;

    await pool.request().query(query);
    res.status(200).json({ message: 'Most recent play deleted successfully' });
  } catch (error) {
    console.error('Error deleting the most recent play:', error);
    res.status(500).json({ error: 'Failed to delete the most recent play' });
  }
});
