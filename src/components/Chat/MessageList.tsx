import React, { useEffect, useRef } from 'react';
import { ChatMessage, GeneratedImageRecord } from '../../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  showTimestamps?: boolean;
  onRegenerate?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onEditImage?: (record: GeneratedImageRecord) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  showTimestamps = true,
  onRegenerate,
  onEditMessage,
  onEditImage
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages[messages.length - 1]?.content, messages[messages.length - 1]?.imageRecord]);

  // Find index of the last assistant message
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i;
      break;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {messages.map((msg, idx) => (
        <MessageItem
          key={msg.id || idx}
          message={msg}
          isLastAssistant={idx === lastAssistantIndex}
          showTimestamps={showTimestamps}
          onRegenerate={onRegenerate}
          onEditMessage={onEditMessage}
          onEditImage={onEditImage}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
