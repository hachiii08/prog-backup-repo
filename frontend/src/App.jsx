import { useEffect, useState } from "react";
import { useNavigate, useParams, Routes, Route } from "react-router-dom";
import "./App.css";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import ChatArea from "./components/ChatArea.jsx";

function ChatApp() {
  const [isConnected, setIsConnected] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("New Conversation");
  const [messages, setMessages] = useState([]);

  const navigate = useNavigate();
  const { conversationId: urlId } = useParams(); // reads /chat/:conversationId from URL

  useEffect(() => {
    fetch("/api/test-connection")
      .then(res => res.json())
      .then(data => setIsConnected(data.connected))
      .catch(() => setIsConnected(false));

    if (urlId) {
      // URL has a conversation ID — load it directly
      loadConversation(urlId);
    } else {
      const savedId = localStorage.getItem("conversationId");
      if (savedId) {
        loadConversation(savedId);
      } else {
        startNewConversation();
      }
    }
  }, [urlId]); // re-run if URL changes

  const startNewConversation = async () => {
    const res = await fetch("/api/new", { method: "POST" });
    const data = await res.json();
    setConversationId(data.conversation_id);
    setConversationTitle("New Conversation");
    localStorage.setItem("conversationId", data.conversation_id);
    setMessages([]);
    navigate("/"); // clear URL on new chat
  };

  const loadConversation = async (id) => {
    const res = await fetch(`/api/history/${id}`);
    const data = await res.json();

    const rows = Array.isArray(data.data) ? data.data : [];

    setConversationId(id);
    localStorage.setItem("conversationId", id);
    setConversationTitle(rows[0]?.conversation_title || "New Conversation");
    setMessages(rows.flatMap(row => [
      { sender: "user", text: row.user_question },
      { sender: "bot", text: row.ai_response || row.error_message || "" }
    ]));
    navigate(`/chat/${id}`); // update URL to show conversation UUID
  };

  return (
    <div className="app-container">
      <Sidebar onNewChat={startNewConversation} onSelectConversation={loadConversation} />
      <div className="main-content">
        <Header isConnected={isConnected} conversationTitle={conversationTitle} />
        <ChatArea
          conversationId={conversationId}
          messages={messages}
          setMessages={setMessages}
          conversationTitle={conversationTitle}
          onTitleUpdate={setConversationTitle}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatApp />} />
      <Route path="/chat/:conversationId" element={<ChatApp />} />
    </Routes>
  );
}

export default App;