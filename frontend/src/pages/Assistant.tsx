// Le token Hugging Face reste côté backend : cette page n'appelle que notre API /chat.
import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Copy, Check, Download, RefreshCw, Sparkles } from 'lucide-react';
import { chatMessage } from '../api/client';

const B500 = '#2563EB', B600 = '#1D4ED8', B700 = '#1E40AF', B100 = '#DBEAFE', B50 = '#EFF6FF';
const G500 = '#16A34A', SLATE = '#64748B', MUTED = '#94A3B8';

interface Msg { role: 'user' | 'assistant'; content: string; ts?: string; id: string; copied?: boolean; }
const mkTs = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const mkId = () => Math.random().toString(36).slice(2, 9);

function toHtml(raw: string): string {
  const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc.split('\n');
  let html = '', inList = false;
  for (let line of lines) {
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line.replace(/^\s*[-*]\s+/, '')}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (/^#{2,4}\s+/.test(line)) html += `<h4>${line.replace(/^#+\s+/, '')}</h4>`;
      else if (line.trim()) html += `<p>${line}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

const SUGGESTIONS = [
  'Analyse le client 1',
  'Que signifie une probabilité de défaut de 80 % ?',
  'Pourquoi le seuil de décision est-il sous 50 % ?',
  'Comment fonctionne la surveillance de dérive ?',
  'Quels sont les facteurs les plus prédictifs du défaut ?',
];

function UserBubble({ msg }: { msg: Msg }) {
  return (
    <motion.div initial={{ opacity: 0, x: 30, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
      <div style={{ textAlign: 'right', maxWidth: 480 }}>
        <div style={{ display: 'inline-block', background: `linear-gradient(135deg, ${B500} 0%, ${B700} 100%)`, color: '#fff', borderRadius: '20px 20px 5px 20px', padding: '11px 17px', fontSize: 13.5, lineHeight: 1.65, wordBreak: 'break-word', boxShadow: `0 4px 24px ${B500}35` }}>{msg.content}</div>
        {msg.ts && <p style={{ margin: '5px 4px 0', fontSize: 10, color: MUTED }}>{msg.ts}</p>}
      </div>
      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${B500}, ${B700})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>Moi</div>
    </motion.div>
  );
}

function BotBubble({ msg, onCopy }: { msg: Msg; onCopy: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, x: -30, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(145deg, ${B50}, ${B100})`, border: `1.5px solid ${B500}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: B500 }}><Bot size={17} /></div>
      <div style={{ maxWidth: 540, flex: 1 }}>
        <div style={{ position: 'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <div className="bot-msg" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px 20px 20px 5px', padding: '12px 44px 12px 16px', fontSize: 13.5, lineHeight: 1.8, color: 'var(--text)', wordBreak: 'break-word', boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }} dangerouslySetInnerHTML={{ __html: toHtml(msg.content) }} />
          <AnimatePresence>
            {hovered && (
              <motion.button initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => onCopy(msg.id)} title={msg.copied ? 'Copié !' : 'Copier'}
                style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 7, border: 'none', background: msg.copied ? '#DCFCE7' : B50, color: msg.copied ? G500 : SLATE, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {msg.copied ? <Check size={14} /> : <Copy size={14} />}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {msg.ts && <p style={{ margin: '5px 4px 0', fontSize: 10, color: MUTED }}>{msg.ts}</p>}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.85 }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(145deg, ${B50}, ${B100})`, border: `1.5px solid ${B500}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: B500 }}><Bot size={17} /></div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px 20px 20px 5px', padding: '14px 20px', display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => <motion.span key={i} animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.85, repeat: Infinity, delay: i * 0.14 }} style={{ width: 7, height: 7, borderRadius: '50%', background: B500 }} />)}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '3rem 2rem', textAlign: 'center' }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05, type: 'spring', stiffness: 260 }}
        style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(145deg, ${B50} 0%, ${B100} 100%)`, border: `1.5px solid ${B500}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: B500 }}><Bot size={30} /></motion.div>
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.025em' }}>Assistant crédit</p>
        <p style={{ margin: 0, fontSize: 13.5, color: SLATE, maxWidth: 320, lineHeight: 1.7 }}>Interrogez le modèle de scoring : analysez un client par son ID, interprétez les prédictions et la dérive des données.</p>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: B50, border: `1px solid ${B100}`, borderRadius: 24, padding: '6px 16px', fontSize: 12, color: B500, fontWeight: 600 }}>
        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
        En ligne · 30 000 clients accessibles
      </div>
    </motion.div>
  );
}

function ConvStats({ messages }: { messages: Msg[] }) {
  if (messages.length === 0) return null;
  const u = messages.filter(m => m.role === 'user').length;
  const b = messages.filter(m => m.role === 'assistant').length;
  const w = messages.reduce((a, m) => a + m.content.split(/\s+/).length, 0);
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', display: 'flex' }}>
      {[['Questions', u], ['Réponses', b], ['Mots', w]].map(([label, value], i) => (
        <div key={label as string} style={{ flex: 1, textAlign: 'center', padding: '11px 6px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: B500 }}>{value}</p>
          <p style={{ margin: 0, fontSize: 9, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 1 }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { const ta = taRef.current; if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; }, [input]);

  const copyMessage = useCallback((id: string) => {
    const msg = messages.find(m => m.id === id); if (!msg) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      setMessages(p => p.map(m => m.id === id ? { ...m, copied: true } : m));
      setTimeout(() => setMessages(p => p.map(m => m.id === id ? { ...m, copied: false } : m)), 2000);
    });
  }, [messages]);

  const exportConversation = useCallback(() => {
    const txt = messages.map(m => `[${m.ts ?? ''}] ${m.role === 'user' ? 'Vous' : 'Assistant'} :\n${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `conversation-credit-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(a.href);
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim(); if (!msg || loading) return;
    if (text) setUsed(p => new Set(p).add(text));
    const userMsg: Msg = { role: 'user', content: msg, ts: mkTs(), id: mkId() };
    const history = [...messages, userMsg];
    setMessages(history); setInput(''); setLoading(true);
    try {
      const r = await chatMessage({ messages: history.map(m => ({ role: m.role, content: m.content })) });
      setMessages([...history, { role: 'assistant', content: r.reponse, ts: mkTs(), id: mkId() }]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setMessages([...history, { role: 'assistant', content: detail ?? "Erreur de connexion à l'API (port 8000).", ts: mkTs(), id: mkId() }]);
    } finally { setLoading(false); }
  }, [input, loading, messages]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const canSend = input.trim().length > 0 && !loading;
  const suggestions = SUGGESTIONS.filter(s => !used.has(s));

  return (
    <>
      <style>{`
        .bot-msg p { margin:0 0 .5em; } .bot-msg p:last-child { margin-bottom:0; }
        .bot-msg ul { margin:.4em 0 .4em 1.2em; padding:0; } .bot-msg li { margin:.28em 0; }
        .bot-msg h4 { color:${B500}; margin:.7em 0 .25em; font-size:13px; font-weight:700; }
        .bot-msg strong { font-weight:700; color:${B600}; }
        .bot-msg code { background:${B50}; color:${B600}; border-radius:5px; padding:1px 6px; font-size:.85em; font-family:monospace; border:1px solid ${B100}; }
        .sugg-btn:hover { background:${B50} !important; border-color:${B100} !important; color:${B500} !important; transform:translateX(3px); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 700, color: B500, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Assistant analytique</p>
          <h1 style={{ margin: 0 }}>Assistant crédit</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: SLATE }}>Interrogez le modèle de scoring et obtenez des explications contextuelles.</p>
        </div>
        <AnimatePresence>
          {messages.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }} onClick={exportConversation}
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 13px', fontSize: 12, cursor: 'pointer', color: SLATE, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}><Download size={14} />Exporter</motion.button>
              <motion.button initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }} onClick={() => { setMessages([]); setUsed(new Set()); }}
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 13px', fontSize: 12, cursor: 'pointer', color: SLATE, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}><RefreshCw size={14} />Nouvelle conversation</motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 276px', gap: '1rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: 640, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div className="msg-area" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.4rem' }}>
            {messages.length === 0 && !loading ? <EmptyState /> : (
              <>
                {messages.map(m => m.role === 'user' ? <UserBubble key={m.id} msg={m} /> : <BotBubble key={m.id} msg={m} onCopy={copyMessage} />)}
                <AnimatePresence>{loading && <Typing />}</AnimatePresence>
              </>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '0.875rem 1rem' }}>
            <div className="chat-input-wrap" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', border: '1.5px solid var(--border)', borderRadius: 12, padding: '6px 6px 6px 12px', background: 'var(--bg-subtle)' }}>
              <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}
                placeholder="Posez une question (ex. « analyse le client 42 »)…"
                style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, maxHeight: 130, fontFamily: 'inherit' }} />
              <button className="send-btn" onClick={() => send()} disabled={!canSend}
                style={{ width: 38, height: 38, borderRadius: 9, border: 'none', background: canSend ? B500 : 'var(--border)', color: '#fff', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Send size={16} /></button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ConvStats messages={messages} />
          <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Sparkles size={14} color={B500} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: B500, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Suggestions</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {suggestions.map((s, i) => (
                <button key={i} className="sugg-btn" onClick={() => send(s)}
                  style={{ textAlign: 'left', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 11px', fontSize: 12, color: 'var(--text-sub)', cursor: 'pointer', lineHeight: 1.4 }}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
