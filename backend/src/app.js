const express = require("express");
const cors = require("cors");
const { isConnectedToDB, runQuery } = require("./services/db.service");
const { runAi } = require("./services/openai.service");
const { saveChat, createConversation, getHistory, getChatById, deleteConversation } = require("./services/chatDb.service");

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Hello World!"
    });
});

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

app.get("/api/inventory-summary", async (req, res) => {
    try {
        const result = await runQuery("SELECT TOP 5 DocNumber FROM WMS.Inbound");
        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error retrieving inventory summary",
            error: err.message
        });
    }
});

app.post("/api/new", (req, res) => {
    const conversationId = createConversation();
    res.json({ 
        conversation_id: conversationId 
    });
});

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

        await saveChat(
            conversation_id || null,
            result.title || conversation_title || null,
            question,
            result.sql || null,
            result.data || null,
            result.success ? "success" : "error",
            result.error || null
        );

        res.json(result);

    } catch (error) {
        res.status(500).json({
            success: false,
            error: "AI processing failed"
        });
    }
});

module.exports = app;