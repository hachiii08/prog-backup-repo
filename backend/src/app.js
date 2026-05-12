const express = require("express");
const cors = require("cors");
const { isConnectedToDB } = require("./services/db.service");
const { runAi } = require("./services/openai.service");
const { saveChat, createConversation, getHistory, getChatById, deleteConversation } = require("./services/chatDb.service");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "WMS Chatbot API is running."
    });
});

// this route checks if the backend can reach the MSSQL database
// used by the frontend header to show database connection status
app.get("/api/test-connection", async (req, res) => {
    try {
        const connected = await isConnectedToDB();
        res.json({
            success: true,
            connected: connected
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            connected: false
        });
    }
});

// this route creates a new conversation session and returns a UUID
// called when the user clicks "New Chat"
app.post("/api/new", (req, res) => {
    const conversationId = createConversation();
    res.json({
        conversation_id: conversationId
    });
});

// this route returns all conversations for the sidebar history list
app.get("/api/history", async (req, res) => {
    try {
        const history = await getHistory();
        res.json({
            success: true,
            data: history
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Failed to get history"
        });
    }
});

// this route returns all messages from a specific conversation
// used when the user clicks a chat from the sidebar
app.get("/api/history/:conversationId", async (req, res) => {
    try {
        const { conversationId } = req.params;
        const messages = await getChatById(conversationId);
        res.json({
            success: true,
            data: messages
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Failed to get conversation"
        });
    }
});

// this route deletes all messages of a conversation from DEV.ChatHistory
app.delete("/api/delete-convo/:id", async (req, res) => {
    const conversationId = req.params.id;

    try {
        const result = await deleteConversation(conversationId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: "Conversation deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Failed to delete conversation"
        });
    }
});

// this is the main chatbot route
// takes the user question, runs the AI, and saves the result to DEV.ChatHistory
// request body needs: question, conversation_id, and optional conversation_title
app.post("/api/ask-ai", async (req, res) => {
    const { question, conversation_id, conversation_title } = req.body;

    if (!question) {
        return res.status(400).json({
            success: false,
            error: "Question is required"
        });
    }

    try {
        const result = await runAi(question, conversation_id, conversation_title);

        // Save full exchange to audit log
        await saveChat(
            conversation_id || null,
            result.title || conversation_title || null,
            question,
            result.sql || null,
            result.data || null,
            result.success ? "success" : "error",
            result.error || null,
            result.executionTimeMs || null
        );

        res.json(result);

    } catch (error) {
        res.status(500).json({
            success: false,
            error: "AI is currently unavailable. Please try again later."
        });
    }
});

module.exports = app;