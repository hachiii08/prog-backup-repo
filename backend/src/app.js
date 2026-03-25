const express = require("express");
const cors = require("cors");
const { isConnectedToDB, runQuery } = require("./services/db.service");
const { runAi } = require("./services/openai.service");

const { createConversation, saveChat, getHistory, getChatById } = require("./services/historyDb.service");//add

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/test-connection", async (req, res) => {
    try {
        const connected = await isConnectedToDB();
        res.json({ success: true, connected: connected });
    } catch (err) {
        res.status(500).json({ success: false, connected: false });
    }
});


app.post("/api/new", (req, res) => {
    const conversationId = createConversation();
    res.json({ 
        conversation_id: conversationId 
    });
});

//
app.get("/api/history", async (req, res) => {
    const history = await getHistory();
    res.json({ success: true, data: history });
});

app.get("/api/history/:conversationId", async (req, res) => {
    const { conversationId } = req.params;
    const messages = await getChatById(conversationId);
    res.json({ success: true, data: messages });
});
//added await


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
  result.title || null,        // removed "|| conversation_title" fallback
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