import { useEffect, useState } from "react";
import '../styles/Sidebar.css';
import { FaPlus } from "react-icons/fa6";
import { FaRegTrashAlt } from "react-icons/fa";

function Sidebar({ onNewChat, onSelectConversation, onRefreshReady }) { // added onRefreshReady
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory(data.data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    if (onRefreshReady) onRefreshReady(fetchHistory);  // ← add this line
}, []);

  const handleNewChat = async () => {
    setSelectedId(null);
    await onNewChat();
    fetchHistory();
  };

  const handleSelect = async (id) => {
    setSelectedId(id);
    await onSelectConversation(id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/delete-convo/${deleteId}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        setDeleteId(null);

        // refresh list
        fetchHistory();

        // optional reset selected
        if (selectedId === deleteId) {
          setSelectedId(null);
        }
      } else {
        console.error("Delete failed:", data.error);
      }

    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const groupedHistory = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sections = {};

    history.forEach((convo, index) => {
      if (!convo.conversation_title) return;

      const date = new Date(convo.created_at);
      const convoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.floor((today - convoDate) / (1000 * 60 * 60 * 24));

      let label = "";
      if (diffDays === 0) label = "Today";
      else if (diffDays === 1) label = "Yesterday";
      else label = `${diffDays} days ago`;

      if (!sections[label]) sections[label] = [];
      sections[label].push({ ...convo, _index: index });
    });

    return sections;
  };

  const sections = groupedHistory();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chat History</h2>
      </div>

      <button className="new-chat-btn" onClick={handleNewChat}>
        <FaPlus className="new-chat-icon" /> New chat
      </button>

      <div className="chat-history">
        {Object.entries(sections).map(([label, convos]) => (
          <div className="history-section" key={label}>
            <h3>{label}</h3>
            {convos.map(convo => (
              <div
                key={convo.id || `${convo.conversation_id}-${convo._index}`}
                className={`chat-item ${selectedId === convo.conversation_id ? 'selected' : ''}`}
              >
                <span 
                  className="chat-title"
                  onClick={() => handleSelect(convo.conversation_id)}
                >
                  {convo.conversation_title || "New Conversation"}
                </span>

                <FaRegTrashAlt
                  className="delete-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(convo.conversation_id);
                    setShowModal(true);
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Conversation</h3>
            <p>Are you sure you want to delete this?</p>

            <div className="modal-buttons">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowModal(false);
                  setDeleteId(null); 
                }}
              >
                Cancel
              </button>

              <button 
                className="delete-btn"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;