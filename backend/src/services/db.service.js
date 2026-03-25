const sql = require('mssql');
const config = require('../../dbconfig');

let pool = null;

async function connectToDB() {
    try{
        if (!pool){
            pool = await sql.connect(config); 
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

async function runQuery(query) {
    try {
        
        await blockKeywords(query);

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
};