import { useState, useRef, useEffect } from "react";
import '../styles/ChatArea.css';
import { FaWarehouse } from "react-icons/fa6";

const MAX_CHARS = 250;

function ChatArea({ conversationId, messages, setMessages, conversationTitle, onTitleUpdate, onNewMessage }) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const lastMessageRef = useRef(null);

  const renderMessage = (text) => {
    if (!text) return <p>{text}</p>;

    const lines = text.split("\n").filter(line => line.trim() !== "");
    const isDashedTable = lines.length >= 2 && /^-+$/.test(lines[1].trim());

    if (!text.includes("|") && !isDashedTable) {
      return <p>{text}</p>;
    }

    let headers = [];
    let rows = [];

    if (text.includes("|")) {
      headers = lines[0].split("|").map(h => h.trim());
      rows = lines.slice(2).map(line => line.split("|").map(cell => cell.trim()));
    } else if (isDashedTable) {
      headers = [lines[0].trim()];
      rows = lines.slice(2).map(line => [line.trim()]);
    }

    return (
      <table className="table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const handleSend = async () => {
    // CHANGE: added input.length > MAX_CHARS check to block oversized input
    if (!input.trim() || isSending || input.length > MAX_CHARS) return;

    setIsSending(true);

    setMessages(prev => [...prev, { sender: "user", text: input }]);

    const typingId = Date.now();
    setMessages(prev => [...prev, { sender: "bot", typing: true, id: typingId }]);

    const userInput = input;
    setInput("");

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userInput,
          conversation_id: conversationId,
          conversation_title: conversationTitle === "New Conversation" ? null : conversationTitle
        })
      });

      const data = await res.json();

      if (data.title) {
        onTitleUpdate(data.title);
        setTimeout(() => onNewMessage?.(), 300);
      } else {
        onNewMessage?.();
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === typingId
            ? { sender: "bot", text: data.data || data.message || "No response from AI" }
            : msg
        )
      );

    } catch (error) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === typingId
            ? { sender: "bot", text: "Error contacting AI service." }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isOverLimit = input.length > MAX_CHARS;
  const showCounter = input.length >= MAX_CHARS - 50;

  return (
    <div className="chat-area">

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
          <div className="empty-chat__icon">
            <FaWarehouse size={22} color="#888" />
          </div>
          <span>WMS Assistant</span>
          <h2>How can I help you today?</h2>
          <p>Ask about inventory, orders, shipments, or warehouse performance.</p>
        </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.sender}`}
              ref={index === messages.length - 1 ? lastMessageRef : null}
            >
              {msg.sender === "bot" && (
                <div className="bot-avatar">AI</div>
              )}
              <div className="message-content">
                {msg.typing ? (
                  <div className="typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  renderMessage(msg.text)
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-chips">
        <button className="chips" onClick={() => setInput("How many inbound today?")} disabled={isSending}>
          Inbound
        </button>
        <button className="chips" onClick={() => setInput("How many outbound today?")} disabled={isSending}>
          Outbound
        </button>
        <button className="chips" onClick={() => setInput("How many countsheetsetup today?")} disabled={isSending}>
          Inventory
        </button>
      </div>

      <div className="input-container">
        <input
          type="text"
          placeholder="Send your message"
          className={`message-input ${isOverLimit ? "over-limit" : ""}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isSending && !isOverLimit && handleSend()}
          disabled={isSending}
          maxLength={MAX_CHARS}  //added
        />

        {showCounter && (
          <span className={`char-counter ${isOverLimit ? "over-limit" : ""}`}>
            {input.length}/{MAX_CHARS}
          </span>
        )}

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={isSending || isOverLimit}
        >
          <span>➤</span>
        </button>
      </div>

    </div>
  );
}

export default ChatArea;