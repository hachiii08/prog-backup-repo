const sql = require('mssql');
const config = require('../../dbconfig');

let pool = null;

async function connectToDB() {
    try{
        if (!pool){
            pool = await sql.connect(config); 
            console.log("Connected to SQL Server");
        }
        return pool;
    }catch(err){
        console.error("Database connection failed: ", err);
        throw err;
    }
}

async function isConnectedToDB() {
    if(pool && pool.connected){
        return true;
    }else{
        try {
            const pool = await connectToDB();
            console.log("Database connection is working");
            return true;
        } catch (err) {
            console.error("Database connection check failed: ", err);
            return false;
        }
    }
}

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

//add
async function InternalQuery(query) {
    try {
        const pool = await connectToDB();
        const result = await pool.request().query(query);
        return { success: true, data: result.recordset };
    } catch (err) {
        return { success: false, message: "Query execution failed", error: err.message };
    }
}


async function runQuery(query) {
    try {
        // Validate query
        await blockKeywords(query);

        // Allow SELECT only
        if (!query.trim().toUpperCase().startsWith("SELECT")) {
            throw new Error("Only SELECT queries are allowed.");
        }

        const pool = await connectToDB();
        const result = await pool.request().query(query);

        return {
            success: true,
            data: result.recordset
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
    InternalQuery
};
