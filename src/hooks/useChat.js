// useChat — React hook that manages the full chat experience.
// Handles: conversation CRUD, message persistence, file uploads,
// AI image generation, and bridges to ViviCore for responses.

import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useVivi } from '@/vivi/hooks/useVivi';
import { EVENTS } from '@/vivi';

function getFileMessageType(file) {
  const type = file.type || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  return 'document';
}

export function useChat() {
  const { vivi, sendText, sendWithFile } = useVivi();
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const awaitingReplyRef = useRef(false);
  const currentIdRef = useRef(null);

  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  // Load all conversations (newest first)
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Conversation.list('-updated_date', 50);
      setConversations(list || []);
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for the selected conversation
  const loadMessages = useCallback(async (id) => {
    if (!id) { setMessages([]); return; }
    try {
      const msgs = await base44.entities.ChatMessage.filter({ conversation_id: id }, 'created_date', 200);
      setMessages(msgs || []);
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  }, []);

  useEffect(() => { loadMessages(currentId); }, [currentId, loadMessages]);

  // Listen for Vivi's replies — always subscribed, gated by ref
  useEffect(() => {
    if (!vivi) return;
    const unsub = vivi.on(EVENTS.CORE_REPLY, async (payload) => {
      if (!awaitingReplyRef.current) return;
      const convId = currentIdRef.current;
      if (convId && payload?.text) {
        try {
          const msg = await base44.entities.ChatMessage.create({
            role: 'vivi',
            content: payload.text,
            conversation_id: convId,
            message_type: 'text',
          });
          setMessages((prev) => [...prev, msg]);
          loadConversations();
        } catch (e) {
          console.error('Failed to save Vivi reply', e);
        }
      }
      awaitingReplyRef.current = false;
      setSending(false);
    });
    return () => { if (unsub) unsub(); };
  }, [vivi, loadConversations]);

  // Create a new conversation
  const createConversation = useCallback(async (title = 'Nueva conversación') => {
    try {
      const conv = await base44.entities.Conversation.create({ title });
      setConversations((prev) => [conv, ...prev]);
      setCurrentId(conv.id);
      setMessages([]);
      return conv;
    } catch (e) {
      console.error('Failed to create conversation', e);
      return null;
    }
  }, []);

  const selectConversation = useCallback((id) => {
    setCurrentId(id);
  }, []);

  const deleteConversation = useCallback(async (id) => {
    try {
      await base44.entities.ChatMessage.deleteMany({ conversation_id: id });
      await base44.entities.Conversation.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentIdRef.current === id) {
        setCurrentId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to delete conversation', e);
    }
  }, []);

  // Send a text message (optionally with a file attachment)
  const sendMessage = useCallback(async (text, file = null) => {
    if (!text.trim() && !file) return;

    let convId = currentIdRef.current;
    let isNew = false;
    if (!convId) {
      const conv = await createConversation(text.slice(0, 50) || 'Nueva conversación');
      if (!conv) return;
      convId = conv.id;
      isNew = true;
    }

    // Upload file if provided
    let fileUrl = null;
    let fileName = null;
    let messageType = 'text';

    if (file) {
      try {
        const result = await base44.integrations.Core.UploadFile({ file });
        fileUrl = result.file_url;
        fileName = file.name;
        messageType = getFileMessageType(file);
      } catch (e) {
        console.error('File upload failed', e);
      }
    }

    // Persist the user's message
    try {
      const userMsg = await base44.entities.ChatMessage.create({
        role: 'user',
        content: text || fileName || 'Archivo',
        conversation_id: convId,
        message_type: messageType,
        file_url: fileUrl,
        file_name: fileName,
      });
      setMessages((prev) => [...prev, userMsg]);

      if (isNew) {
        setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: text.slice(0, 50) } : c));
      }
    } catch (e) {
      console.error('Failed to save message', e);
    }

    // Send to ViviCore for processing
    setSending(true);
    awaitingReplyRef.current = true;
    if (fileUrl) {
      sendWithFile?.(text, fileUrl);
    } else {
      sendText?.(text);
    }

    // Safety timeout — reset if no reply in 45s
    setTimeout(() => {
      if (awaitingReplyRef.current) {
        awaitingReplyRef.current = false;
        setSending(false);
      }
    }, 45000);
  }, [createConversation, sendText, sendWithFile]);

  // Generate an AI image from a text prompt
  const generateImage = useCallback(async (prompt) => {
    if (!prompt.trim()) return;

    let convId = currentIdRef.current;
    if (!convId) {
      const conv = await createConversation(`Imagen: ${prompt.slice(0, 40)}`);
      if (!conv) return;
      convId = conv.id;
    }

    // Save the user's prompt as a message
    try {
      const userMsg = await base44.entities.ChatMessage.create({
        role: 'user',
        content: prompt,
        conversation_id: convId,
        message_type: 'text',
      });
      setMessages((prev) => [...prev, userMsg]);
    } catch (e) {
      console.error(e);
    }

    setSending(true);
    try {
      const result = await base44.integrations.Core.GenerateImage({ prompt });
      if (result?.url) {
        const viviMsg = await base44.entities.ChatMessage.create({
          role: 'vivi',
          content: `Imagen generada para: ${prompt}`,
          conversation_id: convId,
          message_type: 'generated_image',
          file_url: result.url,
          file_name: 'generated_image.png',
        });
        setMessages((prev) => [...prev, viviMsg]);
      }
    } catch (e) {
      console.error('Image generation failed', e);
    }
    setSending(false);
  }, [createConversation]);

  // Export a conversation as a text file
  const exportConversation = useCallback(async (id) => {
    try {
      const conv = conversations.find((c) => c.id === id);
      const msgs = await base44.entities.ChatMessage.filter({ conversation_id: id }, 'created_date', 500);
      const text = msgs.map((m) => `[${m.role === 'user' ? 'Usuario' : 'Vivi'}]\n${m.content}`).join('\n\n---\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conv?.title || 'conversacion'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
  }, [conversations]);

  const filteredConversations = searchQuery
    ? conversations.filter((c) => c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  return {
    conversations: filteredConversations,
    currentId,
    messages,
    loading,
    sending,
    searchQuery,
    setSearchQuery,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
    generateImage,
    exportConversation,
  };
}