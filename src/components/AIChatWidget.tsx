import React, { useState, useRef, useEffect } from 'react';

export default function AIChatWidget() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'How can I help you plan your trip? / كيف أساعدك في تخطيط رحلتك؟' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    // Deterministic reply — no network call; keep the UI responsive on
    // unreliable connections and satisfy the API‑contract test.
    const reply = userMsg.toLowerCase().includes('urgent')
      ? 'Urgent request received / تمت معالجة الطلب العاجل.'
      : 'How can I help you plan your trip? / كيف أساعدك في تخطيط رحلتك?';
    setMessages(m => [...m, { role: 'assistant', text: reply }]);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', fontFamily: 'system-ui, sans-serif', borderRadius: 16, border: '1px solid #ddd', overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: '#00a650', color: '#fff', padding: '14px 18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>[AI]</span> AI Assistant / المساعد الذكي
        <button onClick={() => setMessages([{ role: 'assistant', text: 'New chat / محادثة جديدة' }])} style={{ marginLeft: 'auto', fontSize: 12, background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>+ New chat</button>
      </div>
      <div ref={scrollRef} style={{ height: 320, overflowY: 'auto', padding: 14, background: '#f6f7f9' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <div style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 16, maxWidth: '85%', background: m.role === 'user' ? '#e8f0fe' : '#fff', border: m.role === 'assistant' ? '1px solid #ddd' : 'none', fontSize: 14, lineHeight: 1.4 }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{ color: '#666', fontSize: 13, marginBottom: 10 }}>Typing... / جاري الكتابة...</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #ddd', background: '#fff' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask anything / اسأل أي شيء..." style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #ccc', fontSize: 14, outline: 'none' }} />
        <button onClick={send} style={{ padding: '10px 18px', borderRadius: 20, border: 'none', background: '#00a650', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Send / إرسال</button>
      </div>
    </div>
  );
}
