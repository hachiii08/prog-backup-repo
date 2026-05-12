const sql = require('mssql');
const config = require('../../dbconfig');

// reuse one connection pool across all requests
let pool = null;

// connects to the database and returns the pool
async function connectToDB() {
    try {
        if (!pool) {
            pool = await sql.connect(config);
        }
        return pool;
    } catch (err) {
        console.error("Database connection failed:", err);
        throw err;
    }
}

// checks if the database is reachable, returns true or false
async function isConnectedToDB() {
    if (pool && pool.connected) {
        return true;
    }
    try {
        await connectToDB();
        return true;
    } catch (err) {
        console.error("Database connection check failed:", err);
        return false;
    }
}

// scans the query for dangerous keywords and throws an error if found
async function blockKeywords(query) {
    const dangerousKeywords = [
        'DROP', 'DELETE', 'TRUNCATE', 'ALTER',
        'CREATE', 'INSERT', 'UPDATE', 'EXEC', 'EXECUTE'
    ];

    const upperQuery = query.toUpperCase();

    for (let keyword of dangerousKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(upperQuery)) {
            throw new Error(`Dangerous SQL keyword '${keyword}' detected.`);
        }
    }

    return true;
}

// runs a SELECT query against the WMS database after passing validation
// returns the result rows and execution time in milliseconds
async function runQuery(query) {
    try {
        // block dangerous keywords before touching the database
        await blockKeywords(query);

        // only allow SELECT queries
        if (!query.trim().toUpperCase().startsWith("SELECT")) {
            throw new Error("Only SELECT queries are allowed.");
        }

        const pool = await connectToDB();
        const startTime = Date.now();
        const result = await pool.request().query(query);
        const executionTimeMs = Date.now() - startTime;

        return {
            success: true,
            data: result.recordset,
            executionTimeMs
        };
    } catch (err) {
        return {
            success: false,
            message: "Query execution failed",
            error: err.message
        };
    }
}

module.exports = {
    connectToDB,
    isConnectedToDB,
    runQuery,
    blockKeywords,
};