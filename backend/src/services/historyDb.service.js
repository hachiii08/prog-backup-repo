const { v4: uuidv4 } = require('uuid');
const { connectToDB } = require('../services/db.service');

const createConversation = () => {
  return uuidv4();
};

const saveChat = async (
  conversationId,
  conversationTitle,
  userQuestion,
  generatedSql,
  aiResponse,
  executionStatus,
  errorMessage
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
      .query(`
        INSERT INTO DEV.ChatHistory
        (conversation_id, conversation_title, user_question, generated_sql, ai_response, execution_status, error_message)
        VALUES
        (@conversation_id, @conversation_title, @user_question, @generated_sql, @ai_response, @execution_status, @error_message)
      `);

    return { 
      success: true 
    };

  } catch (err) {
    console.error("Save chat failed:", err);
    return { 
      success: false, 
      error: err.message 
    };
  }
};

const getHistory = async () => {
  try {
    const pool = await connectToDB();

    const result = await pool.request().query(`
      SELECT 
        conversation_id,
        conversation_title,
        MIN(created_at) AS created_at
      FROM DEV.ChatHistory
      GROUP BY conversation_id, conversation_title
      ORDER BY created_at DESC
    `);

    return result.recordset;

  } catch (err) {
    console.error("Get history failed:", err);
    return [];
  }
};

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

module.exports = {
  createConversation,
  saveChat,
  getHistory,
  getChatById,
  getConversationTitle
};