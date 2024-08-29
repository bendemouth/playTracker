const express = require('express');
const sql = require('mssql');
const msal = require('@azure/msal-node');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');

const app = express();
const port = config.PORT || 3000;

// Serve files from the 'public' folder
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

app.use(cors(
  {origin: 'http://pell-city.bestfitsportsdata.com'},
))

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: config.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${config.AZURE_TENANT_ID}`,
    clientSecret: config.AZURE_CLIENT_SECRET
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

const tokenRequest = {
  scopes: ["https://database.windows.net//.default"]
};

let tokenCache = null;
let tokenExpiry = null;

const TOKEN_EXPIRY_BUFFER = 30 * 60 * 1000; // 30 minute buffer

// Function to acquire token
async function getToken() {
  // Check if tokenCache is empty or tokenExpiry is null
  if (!tokenCache || !tokenExpiry || Date.now() >= (tokenExpiry - TOKEN_EXPIRY_BUFFER)) {
    try {
      const response = await cca.acquireTokenByClientCredential(tokenRequest);
      console.log("Token response: ", response);  // Log the entire response

      if (response && response.expiresOn) {
        tokenCache = response.accessToken;

        // Convert expiresOn to a timestamp and validate it
        const expiryTime = new Date(response.expiresOn).getTime();
        
        if (!isNaN(expiryTime)) {
          tokenExpiry = expiryTime;
          console.log("New token acquired. Actual expiry at:", new Date(tokenExpiry).toLocaleString());
        } else {
          console.error("Failed to parse expiresOn. Token expiry time is invalid.");
        }
      } else {
        console.error("Unexpected token response: 'expiresOn' is missing or invalid.");
      }

    } catch (error) {
      console.error("Error acquiring token:", error);
      throw error;
    }
  }

  return tokenCache;
}



// Automatic token renewal function
const TOKEN_EXPIRY_CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes

function backgroundTokenRenewal() {
  setInterval(async () => {
    console.log("Running background token renewal check...");

    try {
      // Check if the token is nearing expiration
      if (!tokenExpiry || Date.now() >= (tokenExpiry - TOKEN_EXPIRY_BUFFER)) {
        console.log("Token is nearing expiration, renewing in background...");
        await getToken(); 
        console.log("Background token renewal successful.");
      } else {
        console.log("Token is still valid, no need for background renewal.");
      }
    } catch (error) {
      console.error("Error during background token renewal:", error);
      
    }
  }, TOKEN_EXPIRY_CHECK_INTERVAL);
}



// Function to connect to the database
async function connectToDatabase() {
  try {
    const token = await getToken();
    const dbConfig = {
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: {
          token: token
        }
      },
      options: {
        encrypt: true // Required for Azure SQL
      }
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

// Retry logic for database connection
async function connectWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await connectToDatabase();
      return; // Exit loop if successful
    } catch (error) {
      console.error(`Connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log("Retrying...");
      } else {
        console.log("No more retries, exiting.");
        throw error; // Exit after all retries fail
      }
    }
  }
}

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);

  //Automatic token renewal function
  backgroundTokenRenewal();

  // Attempt to connect to the database when the server starts
  connectWithRetry().catch(error => {
    console.error('Failed to connect after retries:', error);
  });
});

// Add APIs to POST plays to the database
app.post('/api/plays', async (req, res) => {
  try {
    const { playNumber, playSituation, players, playAction, playResult } = req.body;

      console.log("Received data: ", req.body);

      const pool = await sql.connect({
          server: config.DB_SERVER,
          database: config.DB_DATABASE,
          authentication: {
              type: 'azure-active-directory-access-token',
              options: { token: await getToken() }
          },
          options: { encrypt: true }
      });

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
      console.error('Error inserting play:', err);
      res.status(500).json({ message: 'Database insert failed.' });
  }
});

// Add APIs to GET play data from the database
app.get('/api/plays', async (req, res) => {
  try {
    const pool = await sql.connect({
        server: config.DB_SERVER,
        database: config.DB_DATABASE,
        authentication: {
            type: 'azure-active-directory-access-token',
            options: { token: await getToken() }
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


// Add API to check user login information
app.post('/api/login', async (req, res) => {

  
  const { username, password } = req.body;

  try {
    const pool = await sql.connect({
      server: config.DB_SERVER,
      database: config.DB_DATABASE,
      authentication: {
        type: 'azure-active-directory-access-token',
        options: { token: await getToken() }
      },
      options: { encrypt: true }
    });

    // Query the database for the provided username and password
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, password)
      .query('SELECT * FROM LoginInfo WHERE username = @username AND password = @password');

    if (result.recordset.length > 0) {
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Database retrieval failed.' });
  }
});


// Add API to delete most recent play from database
app.delete('/api/plays', async (req, res) => {
  try {
      // Assuming `db` is your Azure SQL connection pool or connection instance
      const request = new sql.Request();

      // SQL Query to delete the most recent play
      const query = `
          DELETE FROM PellCityBoys2425
          WHERE [play-id] = (
              SELECT TOP 1 [play-id]
              FROM PellCityBoys2425
              ORDER BY [play-id] DESC
          );
      `;

      // Execute the query
      await request.query(query);

      // Send success response
      res.status(200).json({ message: 'Most recent play deleted successfully' });
  } catch (error) {
      console.error('Error deleting the most recent play:', error);
      res.status(500).json({ error: 'Failed to delete the most recent play' });
  }
});