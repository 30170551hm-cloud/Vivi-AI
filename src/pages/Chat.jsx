import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput from '@/components/chat/ChatInput';
import ConversationSidebar from '@/components/chat/ConversationSidebar';
import PageTransition from '@/components/PageTransition';

// Full chat page — ChatGPT-style messaging with Vivi.
// Supports: text, file uploads (images/docs/audio/video), AI image generation,
// conversation management (create/search/delete/export), and copy messages.
export default function Chat() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chat = useChat();

  const currentConversation = chat.conversations.find((c) => c.id === chat.currentId);

  return (
    <PageTransition>
      <div className="h-screen flex flex-col bg-[#0A0A0C] text-white">
        {/* Header */}
        <div
          className="flex items-center gap-2 p-4 border-b border-white/10"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-white/80"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/5 text-white/80"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-lg font-medium truncate text-white/90">
            {currentConversation?.title || 'Chat con Vivi'}
          </h1>
        </div>

        {/* Message list */}
        <ChatMessageList messages={chat.messages} sending={chat.sending} />

        {/* Input bar */}
        <ChatInput
          onSend={chat.sendMessage}
          onGenerateImage={chat.generateImage}
          sending={chat.sending}
        />

        {/* Conversation sidebar drawer */}
        <ConversationSidebar
          conversations={chat.conversations}
          currentId={chat.currentId}
          searchQuery={chat.searchQuery}
          setSearchQuery={chat.setSearchQuery}
          onCreate={() => { chat.createConversation(); setSidebarOpen(false); }}
          onSelect={(id) => { chat.selectConversation(id); setSidebarOpen(false); }}
          onDelete={chat.deleteConversation}
          onExport={chat.exportConversation}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </PageTransition>
  );
}