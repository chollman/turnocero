import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ChatWindow from './ChatWindow';

// Only renders on desktop (≥960px); mobile uses dedicated routes
export default function ChatWindowManager() {
  const { user } = useAuth();
  const { openOrder } = useChat();

  if (!user || typeof window === 'undefined' || window.innerWidth < 960) return null;

  return (
    <>
      {openOrder.map((userId, idx) => (
        <ChatWindow
          key={userId}
          userId={userId}
          index={idx}
          currentUserId={user._id}
        />
      ))}
    </>
  );
}
