const { v4: uuidv4 } = require('uuid');
const { connectToDB } = require('../services/db.service');
const sql = require('mssql');

// generates a new unique conversation ID
const createConversation = () => {
    return uuidv4();
};

// saves a chat exchange to DEV.ChatHistory
const saveChat = async (
    conversationId,
    conversationTitle,
    userQuestion,
    generatedSql,
    aiResponse,
    executionStatus,
    errorMessage,
    executionTimeMs
) => {
    try {
        const pool = await connectToDB();

        await pool.request()
            .input('conversation_id', conversationId)
            .input('conversation_title', conversationTitle)
            .input('user_question', userQuestion)
            .input('generated_sql', generatedSql)
            .input('ai_response', aiResponse)
            .input('execution_status', executionStatus)
            .input('error_message', errorMessage)
            .input('execution_time_ms', sql.Int, executionTimeMs ?? null)
            .query(`
                INSERT INTO DEV.ChatHistory
                (conversation_id, conversation_title, user_question, generated_sql, ai_response, execution_status, error_message, execution_time_ms)
                VALUES
                (@conversation_id, @conversation_title, @user_question, @generated_sql, @ai_response, @execution_status, @error_message, @execution_time_ms)
            `);

        return { success: true };

    } catch (err) {
        console.error("Save chat failed:", err);
        return {
            success: false,
            error: err.message
        };
    }
};

// returns all conversations grouped by ID for the sidebar
const getHistory = async () => {
    try {
        const pool = await connectToDB();

        const result = await pool.request().query(`
            SELECT 
                conversation_id,
                MAX(conversation_title) AS conversation_title,
                MAX(created_at) AS created_at
            FROM DEV.ChatHistory
            GROUP BY conversation_id
            ORDER BY MAX(created_at) DESC
        `);

        return result.recordset;

    } catch (err) {
        console.error("Get history failed:", err);
        return [];
    }
};

// returns all messages for a specific conversation
const getChatById = async (conversationId) => {
    try {
        const pool = await connectToDB();

        const result = await pool.request()
            .input('conversation_id', conversationId)
            .query(`
                SELECT *
                FROM DEV.ChatHistory
                WHERE conversation_id = @conversation_id
                ORDER BY created_at ASC
            `);

        return result.recordset;

    } catch (err) {
        console.error("Get chat by ID failed:", err);
        return [];
    }
};

// returns the existing title of a conversation to avoid regenerating it
const getConversationTitle = async (conversationId) => {
    try {
        const pool = await connectToDB();

        const result = await pool.request()
            .input('conversation_id', conversationId)
            .query(`
                SELECT TOP 1 conversation_title
                FROM DEV.ChatHistory
                WHERE conversation_id = @conversation_id
            `);

        return result.recordset.length > 0
            ? result.recordset[0].conversation_title
            : null;

    } catch (err) {
        console.error("Get conversation title failed:", err);
        return null;
    }
};

// permanently deletes all messages in a conversation
const deleteConversation = async (conversationId) => {
    try {
        const pool = await connectToDB();

        await pool.request()
            .input('conversation_id', conversationId)
            .query(`
                DELETE FROM DEV.ChatHistory
                WHERE conversation_id = @conversation_id
            `);

        return { success: true };

    } catch (err) {
        console.error("Delete conversation failed:", err);
        return {
            success: false,
            error: err.message
        };
    }
};

module.exports = {
    createConversation,
    saveChat,
    getHistory,
    getChatById,
    getConversationTitle,
    deleteConversation
};