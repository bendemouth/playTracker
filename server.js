const express = require('express');
const sql = require('mssql');
const msal = require('@azure/msal-node');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;

// Serve static files
const path = require('path');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

app.use(express.json());

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

const tokenRequest = {
  scopes: ["https://database.windows.net//.default"]
};

let tokenCache = null;
let tokenExpiry = null;

// Function to acquire a new token if needed
async function getToken() {
  if (!tokenCache || Date.now() >= tokenExpiry) {
    try {
      const response = await cca.acquireTokenByClientCredential(tokenRequest);
      tokenCache = response.accessToken;
      tokenExpiry = Date.now() + (response.expiresIn * 1000); // Token expiry time
      console.log("New token acquired");
      console.log("Acquired Token:", tokenCache);  // Log the token here
    } catch (error) {
      console.error("Error acquiring token:", error);
      throw error;
    }
  }
  return tokenCache;
}

// Function to connect to the database
async function connectToDatabase() {
  try {
    const token = await getToken();
    const dbConfig = {
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
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
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Attempt to connect to the database when the server starts
  connectWithRetry().catch(error => {
    console.error('Failed to connect after retries:', error);
  });
});

// Add APIs to POST to the database
app.post('/api/plays', async (req, res) => {
  try {
    const { playNumber, playSituation, players, playAction, playResult } = req.body;

      console.log("Received data: ", req.body);

      const pool = await sql.connect({
          server: process.env.DB_SERVER,
          database: process.env.DB_DATABASE,
          authentication: {
              type: 'azure-active-directory-access-token',
              options: { token: await getToken() }
          },
          options: { encrypt: true }
      });

      const query = `
      INSERT INTO PellCityBoys2425 
      ([play-number], [play_situation], [players-involved], [play-action], [play-result])
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

// Add APIs to GET from the database
app.get('/api/plays', async (req, res) => {
  try {
    const pool = await sql.connect({
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
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
