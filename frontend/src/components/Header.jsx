import '../styles/Header.css'; 

function Header({ isConnected, conversationTitle }) 
{
  return (
    <div className="header">
      <h2>{conversationTitle || "New Conversation"}</h2>
      <div className="assistant-status">
        <span
          className={`status-dot ${isConnected ? "green" : "red"}`}
        ></span>
        <h4>AI Assistant</h4>
      </div>
    </div>
  );
}

export default Header;