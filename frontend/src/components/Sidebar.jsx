import { useEffect, useState } from "react";
import '../styles/Sidebar.css';
import { FaPlus } from "react-icons/fa6";

function Sidebar({ onNewChat, onSelectConversation }) {
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const fetchHistory = async () => {
    const res = await fetch("/api/history");
    const data = await res.json();
    setHistory(Array.isArray(data.data) ? data.data : []);
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleNewChat = async () => {
    await onNewChat();
    fetchHistory();
  };

  const handleSelect = (id) => {
    setSelectedId(id);
    onSelectConversation(id);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chat History</h2>
      </div>

      <button className="new-chat-btn" onClick={handleNewChat}>
        <FaPlus className="new-chat-icon" /> New chat
      </button>

      <div className="chat-history">
        {(() => {
          const now = new Date();
          const sections = {};

          history.forEach(convo => {
            if (!convo.conversation_title) return;

            const date = new Date(convo.created_at);

            // CHANGED: strip time from both dates before comparing to fix timezone -1 bug
            const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const convoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const diffDays = Math.floor((nowDate - convoDate) / (1000 * 60 * 60 * 24));

            let label = "";

            if (diffDays === 0) label = "Today";
            else if (diffDays === 1) label = "Yesterday";
            else label = `${diffDays} days ago`;

            if (!sections[label]) sections[label] = [];
            sections[label].push(convo);
          });

          return Object.entries(sections).map(([label, convos]) =>
            convos.length > 0 && (
              <div className="history-section" key={label}>
                <h3>{label}</h3>
                {convos.map(convo => (
                  <div
                    key={convo.conversation_id}
                    className={`chat-item ${selectedId === convo.conversation_id ? 'selected' : ''}`}
                    onClick={() => handleSelect(convo.conversation_id)}
                  >
                    {convo.conversation_title}
                  </div>
                ))}
              </div>
            )
          );
        })()}
      </div>
    </div>
  );
}

export default Sidebar;