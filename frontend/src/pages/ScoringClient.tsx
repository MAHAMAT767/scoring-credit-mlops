import { useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Search, AlertCircle, TrendingUp, TrendingDown, Clock, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { getClient, predict, explain } from '../api/client';
import type { ClientData, ScoreResponse, ExplainResponse } from '../types';

function SpotlightCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  return (
    <div ref={ref}
      onMouseMove={(e) => { if (!ref.current) return; const r = ref.current.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
      onMouseEnter={() => setOpacity(1)} onMouseLeave={() => setOpacity(0)}
      style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)',
        transform: `translate(${pos.x - 160}px, ${pos.y - 160}px)`,
        opacity, transition: 'opacity 0.3s ease', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

function BorderBeam({ color = '#2563eb', duration = 5 }: { color?: string; duration?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <motion.div style={{ position: 'absolute', width: 80, height: '150%', top: '-25%', left: '-40px',
        background: `linear-gradient(transparent, ${color}55, transparent)`, filter: 'blur(1px)' }}
        animate={{ rotate: [0, 360] }} transition={{ duration, repeat: Infinity, ease: 'linear' }} />
      <div style={{ position: 'absolute', inset: 1.5, borderRadius: 'inherit', background: 'var(--card)', zIndex: 1 }} />
    </div>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 22, filter: 'blur(4px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
      {children}
    </motion.div>
  );
}

const RISQUE_C: Record<string, string> = { faible: 'var(--success)', 'modéré': 'var(--warning)', 'élevé': 'var(--danger)' };
const RISQUE_BG: Record<string, string> = { faible: 'var(--success-bg)', 'modéré': 'var(--warning-bg)', 'élevé': 'var(--danger-bg)' };
const RISQUE_BORDER: Record<string, string> = { faible: 'var(--success-border)', 'modéré': 'var(--warning-border)', 'élevé': 'var(--danger-border)' };
const RISQUE_GLOW: Record<string, string> = { faible: 'rgba(16,185,129,0.25)', 'modéré': 'rgba(245,158,11,0.25)', 'élevé': 'rgba(220,38,38,0.3)' };
const BEAM_COLOR: Record<string, string> = { faible: '#10b981', 'modéré': '#f59e0b', 'élevé': '#ef4444' };

const FEATURE_FR: Record<string, string> = {
  LIMIT_BAL: 'Limite de crédit', AGE: 'Âge', SEX: 'Sexe', EDUCATION: "Niveau d'études", MARRIAGE: 'Statut marital',
  PAY_1: 'Statut paiement M1', PAY_2: 'Statut paiement M2', PAY_3: 'Statut paiement M3',
  PAY_4: 'Statut paiement M4', PAY_5: 'Statut paiement M5', PAY_6: 'Statut paiement M6',
  BILL_AMT1: 'Montant facturé M1', BILL_AMT2: 'Montant facturé M2', BILL_AMT3: 'Montant facturé M3',
  BILL_AMT4: 'Montant facturé M4', BILL_AMT5: 'Montant facturé M5', BILL_AMT6: 'Montant facturé M6',
  PAY_AMT1: 'Remboursé M1', PAY_AMT2: 'Remboursé M2', PAY_AMT3: 'Remboursé M3',
  PAY_AMT4: 'Remboursé M4', PAY_AMT5: 'Remboursé M5', PAY_AMT6: 'Remboursé M6',
  CREDIT_UTILIZATION: "Taux d'utilisation du crédit", PAYMENT_RATIO: 'Ratio de remboursement',
  N_MONTHS_DELAYED: 'Nombre de mois en retard', MAX_DELAY: 'Retard maximal', MEAN_PAY_STATUS: 'Statut de paiement moyen',
  LAST_BILL_RATIO: 'Ratio dernière facture', EVER_DELAYED: 'A déjà été en retard',
  BILL_MEAN: 'Encours moyen', PAYAMT_MEAN: 'Remboursement moyen',
};
function cleanFeatureName(raw: string): string {
  const c = raw.replace(/^(num__|cat__|remainder__)/, '');
  const base = Object.keys(FEATURE_FR).find(k => c === k || c.startsWith(k + '_'));
  return base ? FEATURE_FR[base] : c.replace(/_/g, ' ');
}

function getRecoGlobale(niveau: string) {
  if (niveau === 'élevé') return { titre: 'Crédit à refuser', message: "Risque de défaut élevé : refuser le crédit ou exiger des garanties supplémentaires.", couleur: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' };
  if (niveau === 'modéré') return { titre: 'Étude approfondie recommandée', message: "Risque modéré : analyser plus finement le dossier (revenus, historique) avant de décider.", couleur: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' };
  return { titre: 'Crédit accordable', message: "Profil solvable : le crédit peut être accordé dans les conditions standard.", couleur: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)' };
}

function riskBadge(niveau: string) {
  const c = RISQUE_C[niveau] ?? 'var(--text-muted)';
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: RISQUE_BG[niveau], border: `1px solid ${RISQUE_BORDER[niveau]}`, padding: '2px 10px', borderRadius: 20 }}>{niveau.toUpperCase()}</span>;
}

function GaugeCircle({ pct, couleur }: { pct: number; couleur: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const r = 66, cx = 90, cy = 92, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const angle = -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
  const dotX = cx + r * Math.cos(angle), dotY = cy + r * Math.sin(angle);
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: `radial-gradient(circle, ${couleur}25 0%, transparent 70%)`, filter: 'blur(10px)' }} />
      <svg width="180" height="184" viewBox="0 0 180 184">
        <defs>
          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={couleur} stopOpacity={1} /><stop offset="100%" stopColor={couleur} stopOpacity={0.5} />
          </linearGradient>
          <filter id="gGlow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={couleur} strokeWidth="18" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} opacity={0.07} />
        <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gGrad)" strokeWidth="10" strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ strokeDasharray: `0 ${circ}` }} animate={inView ? { strokeDasharray: `${dash} ${circ}` } : {}}
          transition={{ duration: 1.3, ease: [0.34, 1.1, 0.64, 1], delay: 0.1 }} filter="url(#gGlow)" />
        {ticks.map(t => { const a = -Math.PI / 2 + (t / 100) * 2 * Math.PI;
          return <line key={t} x1={cx + (r - 14) * Math.cos(a)} y1={cy + (r - 14) * Math.sin(a)} x2={cx + (r - 6) * Math.cos(a)} y2={cy + (r - 6) * Math.sin(a)} stroke="var(--border)" strokeWidth={1.5} strokeLinecap="round" />; })}
        <motion.circle cx={dotX} cy={dotY} r={6} fill={couleur} initial={{ opacity: 0, r: 0 }} animate={inView ? { opacity: 1, r: 6 } : {}} transition={{ duration: 0.4, delay: 1.3 }} filter="url(#gGlow)" />
        <motion.text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fontWeight="900" fill={couleur}
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.9 }}>{pct}%</motion.text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)" fontWeight="700" letterSpacing="0.1em">PROBABILITÉ</text>
      </svg>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  const [hov, setHov] = useState(false);
  const color = 'var(--primary-light)';
  return (
    <motion.div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} whileHover={{ y: -2, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{ background: hov ? 'rgba(37,99,235,0.08)' : 'var(--bg-subtle)', border: `1px solid ${hov ? 'rgba(37,99,235,0.35)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 12px', overflow: 'hidden', transition: 'background .2s, border-color .2s' }}>
      <p style={{ margin: '0 0 2px', fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: hov ? color : 'var(--text)', transition: 'color .2s' }}>{value}</p>
    </motion.div>
  );
}

function SHAPFactorCard({ label, shapValue, maxShap, direction, index }: { label: string; shapValue: number; maxShap: number; direction: 'augmente' | 'diminue'; index: number }) {
  const [hov, setHov] = useState(false);
  const color = direction === 'augmente' ? 'var(--danger)' : 'var(--success)';
  const colorHex = direction === 'augmente' ? '#ef4444' : '#10b981';
  const pct = (Math.abs(shapValue) / maxShap) * 100;
  const Icon = direction === 'augmente' ? TrendingUp : TrendingDown;
  return (
    <motion.div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      initial={{ opacity: 0, x: direction === 'augmente' ? -12 : 12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 280, damping: 24 }} whileHover={{ scale: 1.02, y: -1 }}
      style={{ background: hov ? `${colorHex}0d` : 'var(--card)', border: `1px solid ${hov ? `${colorHex}44` : (direction === 'augmente' ? 'var(--danger-border)' : 'var(--success-border)')}`,
        borderRadius: 8, padding: '10px 14px', transition: 'all 0.2s ease', boxShadow: hov ? `0 4px 16px ${colorHex}20` : 'none', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <motion.div animate={hov ? { rotate: direction === 'augmente' ? -8 : 8, scale: 1.15 } : { rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          style={{ width: 22, height: 22, borderRadius: 5, background: `${colorHex}18`, border: `1px solid ${colorHex}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={11} color={color} />
        </motion.div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', flexShrink: 0, color }}>{shapValue > 0 ? '+' : ''}{shapValue.toFixed(3)}</span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.85, ease: [0.34, 1.1, 0.64, 1], delay: 0.05 * index + 0.1 }}
          style={{ height: '100%', borderRadius: 4, background: color, boxShadow: `0 0 6px ${colorHex}55` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Impact : <b style={{ color }}>{pct.toFixed(0)}%</b></span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>#{index + 1}</span>
      </div>
    </motion.div>
  );
}

const SectionLabel = ({ children }: { children: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ width: 3, height: 16, background: 'var(--primary-light)', borderRadius: 2, transformOrigin: 'left', flexShrink: 0 }} />
    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</p>
  </div>
);

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.4, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <Search size={44} color="var(--border)" style={{ marginBottom: 16 }} />
        </motion.div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-sub)' }}>Entrez un ID client pour lancer l'analyse</p>
        <p style={{ margin: '0 auto', fontSize: 12, maxWidth: 380, lineHeight: 1.6 }}>Vous obtiendrez la probabilité de défaut, la décision d'octroi, le détail des facteurs SHAP et l'issue réelle du client.</p>
      </div>
    </motion.div>
  );
}

function AnalysisLoader() {
  const steps = ['Récupération du client…', 'Prédiction Random Forest…', 'Calcul SHAP…', 'Décision métier…'];
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 600); return () => clearInterval(t); }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '3rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i} style={{ position: 'absolute', inset: i * 6, border: '2px solid transparent', borderTopColor: i === 0 ? 'var(--primary-light)' : i === 1 ? 'var(--warning)' : 'var(--danger)', borderRadius: '50%' }}
            animate={{ rotate: 360 }} transition={{ duration: 1 + i * 0.4, repeat: Infinity, ease: 'linear' }} />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.p key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
            style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--primary-light)' }}>{steps[step]}</motion.p>
        </AnimatePresence>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          {steps.map((_, i) => <motion.div key={i} animate={{ scale: i <= step ? 1 : 0.6, opacity: i <= step ? 1 : 0.3 }} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-light)' }} />)}
        </div>
      </div>
    </motion.div>
  );
}

const EDU: Record<number, string> = { 1: 'Master', 2: 'Université', 3: 'Lycée', 4: 'Autres' };
const MAR: Record<number, string> = { 1: 'Marié(e)', 2: 'Célibataire', 3: 'Autres' };

export default function ScoringClient() {
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [client, setClient] = useState<ClientData | null>(null);
  const [clientNo, setClientNo] = useState<number | null>(null);
  const [actual, setActual] = useState<number | null>(null);
  const [pred, setPred] = useState<ScoreResponse | null>(null);
  const [shap, setShap] = useState<ExplainResponse | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  const handleSearch = async () => {
    const id = parseInt(searchId.trim(), 10);
    if (!id) { setErreur('Entrez un ID client avant de lancer la recherche.'); return; }
    setLoading(true); setErreur(''); setClient(null); setPred(null); setShap(null);
    try {
      const lookup = await getClient(id);
      const [score, exp] = await Promise.all([predict(lookup.client_data), explain(lookup.client_data)]);
      setClient(lookup.client_data); setClientNo(lookup.client_id); setActual(lookup.actual_default);
      setPred(score); setShap(exp);
      setAnalyzedAt(new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' }));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setErreur(typeof detail === 'string' ? detail : (e?.message ?? "Impossible de joindre l'API (port 8000)."));
    } finally { setLoading(false); }
  };

  const contribs = (shap?.top_contributions ?? []).map(c => ({ feature: c.feature, shap_value: c.contribution, direction: c.contribution > 0 ? 'augmente' : 'diminue' as 'augmente' | 'diminue' }));
  const chartData = contribs.slice(0, 10).map(c => ({ feature: cleanFeatureName(c.feature), value: Math.abs(c.shap_value), raw: c.shap_value, direction: c.direction })).reverse();
  const increasing = contribs.filter(c => c.direction === 'augmente').slice(0, 5);
  const decreasing = contribs.filter(c => c.direction === 'diminue').slice(0, 5);
  const maxShap = Math.max(...contribs.map(c => Math.abs(c.shap_value)), 0.001);
  // Niveau aligné sur le seuil métier, pas sur des tranches fixes.
  // Zone de prudence de ±10 % autour du seuil = "à étudier".
  const BAND = 0.10;
  const niveauFromSeuil = (prob: number, seuil: number): 'faible' | 'modéré' | 'élevé' =>
    prob < seuil - BAND ? 'faible' : prob > seuil + BAND ? 'élevé' : 'modéré';
  const niveau = pred ? niveauFromSeuil(pred.probability_default, pred.threshold) : 'faible';
  const couleur = RISQUE_C[niveau];
  const pct = pred ? Math.round(pred.probability_default * 100) : 0;
  const refused = pred ? pred.decision.startsWith('Crédit refusé') : false;
  const reco = pred ? getRecoGlobale(niveau) : null;

  const monthsLate = client ? [client.PAY_1, client.PAY_2, client.PAY_3, client.PAY_4, client.PAY_5, client.PAY_6].filter(v => v >= 1).length : 0;
  const infos = client ? [
    { label: 'Limite de crédit', value: Number(client.LIMIT_BAL).toLocaleString('fr-FR') },
    { label: 'Âge', value: `${client.AGE} ans` },
    { label: 'Sexe', value: client.SEX === 1 ? 'Homme' : 'Femme' },
    { label: 'Éducation', value: EDU[client.EDUCATION] ?? '—' },
    { label: 'Statut', value: MAR[client.MARRIAGE] ?? '—' },
    { label: 'Mois en retard', value: `${monthsLate} / 6` },
  ] : [];

  const axisProps = { tick: { fontSize: 10, fill: 'var(--text-muted)' }, axisLine: false as const, tickLine: false as const };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Reveal>
        <motion.div whileHover={{ borderColor: 'var(--primary-light)', boxShadow: '0 0 24px rgba(37,99,235,0.12)' }} transition={{ duration: 0.3 }}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem', boxShadow: 'var(--shadow-xs)', position: 'relative', overflow: 'hidden' }}>
          <SectionLabel>Rechercher un client</SectionLabel>
          <p style={{ margin: '0 0 1rem', fontSize: 12, color: 'var(--text-muted)' }}>Entrez un ID client (1 à 30000). Vous obtiendrez le risque de défaut, le détail SHAP et l'issue réelle du client.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="number" value={searchId} onChange={e => setSearchId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="ID client (ex. 1, 42, 500...)"
                style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <motion.button onClick={handleSearch} disabled={loading} whileHover={!loading ? { scale: 1.03 } : {}} whileTap={!loading ? { scale: 0.96 } : {}}
              style={{ padding: '9px 24px', background: loading ? 'var(--primary-bg)' : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)', color: loading ? 'var(--primary-light)' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {loading ? 'Analyse…' : 'Analyser'}
            </motion.button>
          </div>
          <AnimatePresence>
            {erreur && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                <AlertCircle size={14} />{erreur}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Reveal>

      <AnimatePresence>{loading && <AnalysisLoader />}</AnimatePresence>

      <AnimatePresence>
        {pred && client && !loading && (
          <motion.div ref={resultRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <Reveal delay={0.05}>
              <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                      style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--primary-light)', fontSize: 11, fontWeight: 700, color: 'var(--primary-light)' }}>#{clientNo}</motion.div>
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Client N° {clientNo}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{EDU[client.EDUCATION]} · {MAR[client.MARRIAGE]} · {client.AGE} ans</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, justifyContent: 'flex-end' }}>
                      <Clock size={11} color="var(--text-muted)" /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analysé le {analyzedAt}</span>
                    </div>
                    {actual !== null && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Issue réelle :&nbsp;
                        <span style={{ fontWeight: 700, color: actual === 1 ? 'var(--danger)' : 'var(--success)' }}>{actual === 1 ? 'A fait défaut' : 'A remboursé'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
                  {infos.map(({ label, value }, i) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, type: 'spring', stiffness: 280, damping: 22 }}>
                      <StatPill label={label} value={value} />
                    </motion.div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>

            <Reveal delay={0.1}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <motion.div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem', position: 'relative', overflow: 'hidden', boxShadow: `0 0 30px ${RISQUE_GLOW[niveau]}` }}>
                  <BorderBeam color={BEAM_COLOR[niveau]} duration={4} />
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <p style={{ margin: '0 0 1rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Indicateur de risque de défaut</p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
                      <GaugeCircle pct={pct} couleur={couleur} />
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
                        style={{ textAlign: 'center', width: '100%', background: RISQUE_BG[niveau], border: `1.5px solid ${RISQUE_BORDER[niveau]}`, borderRadius: 8, padding: '0.75rem' }}>
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: couleur, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Niveau de risque</p>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: couleur }}>{niveau.toUpperCase()}</p>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem' }}>
                  <p style={{ margin: '0 0 1rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Résultat de la prédiction</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: refused ? 'var(--danger-bg)' : 'var(--success-bg)', border: `1px solid ${refused ? 'var(--danger-border)' : 'var(--success-border)'}`, borderRadius: 8 }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Décision</p>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: refused ? 'var(--danger)' : 'var(--success)' }}>{refused ? 'Crédit refusé' : 'Crédit accordé'}</p>
                      </div>
                      {refused ? <TrendingUp size={28} color="var(--danger)" /> : <TrendingDown size={28} color="var(--success)" />}
                    </motion.div>
                    {[['Probabilité de défaut', `${(pred.probability_default * 100).toFixed(1)}%`], ['Niveau de risque', null], ['Seuil de décision', `${(pred.threshold * 100).toFixed(1)}%`]].map(([label, value], i) => (
                      <motion.div key={label as string} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.07 }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 7, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                        {label === 'Niveau de risque' ? riskBadge(niveau) : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</span>}
                      </motion.div>
                    ))}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Score de risque</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: couleur }}>{pct}%</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }} style={{ height: '100%', borderRadius: 6, background: couleur }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--success)' }}>Faible</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Seuil : {(pred.threshold * 100).toFixed(0)}%</span>
                        <span style={{ fontSize: 9, color: 'var(--danger)' }}>Élevé</span>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>
            </Reveal>

            {contribs.length > 0 && (
              <Reveal delay={0.2}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
                    style={{ background: 'linear-gradient(135deg, var(--danger-bg) 0%, var(--card) 100%)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.4rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--danger), transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={14} color="var(--danger)" /></div>
                      <div><p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Facteurs augmentant le risque</p>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{increasing.length} facteur{increasing.length > 1 ? 's' : ''} identifié{increasing.length > 1 ? 's' : ''}</p></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {increasing.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Rien à signaler ici.</p>
                        : increasing.map((c, i) => <SHAPFactorCard key={i} label={cleanFeatureName(c.feature)} shapValue={c.shap_value} maxShap={maxShap} direction="augmente" index={i} />)}
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}
                    style={{ background: 'linear-gradient(135deg, var(--success-bg) 0%, var(--card) 100%)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.4rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--success), transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingDown size={14} color="var(--success)" /></div>
                      <div><p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Facteurs réduisant le risque</p>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{decreasing.length} facteur{decreasing.length > 1 ? 's' : ''} protecteur{decreasing.length > 1 ? 's' : ''}</p></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {decreasing.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Aucun facteur favorable détecté.</p>
                        : decreasing.map((c, i) => <SHAPFactorCard key={i} label={cleanFeatureName(c.feature)} shapValue={c.shap_value} maxShap={maxShap} direction="diminue" index={i} />)}
                    </div>
                  </motion.div>
                </div>
              </Reveal>
            )}

            {chartData.length > 0 && (
              <Reveal delay={0.25}>
                <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Visualisation SHAP — Contributions par variable</p>
                  <p style={{ margin: '0 0 1rem', fontSize: 11, color: 'var(--text-muted)' }}>Rouge = augmente le risque, vert = le réduit. Barres triées par impact absolu.</p>
                  <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 34)}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" {...axisProps} tickFormatter={(v: number) => v.toFixed(3)} />
                      <YAxis type="category" dataKey="feature" {...axisProps} width={180} />
                      <ReferenceLine x={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                        formatter={(_v: any, _n: any, props: any) => { const d = props.payload; return [`${d.raw > 0 ? '+' : ''}${d.raw.toFixed(4)} (${d.direction === 'augmente' ? '↑ risque' : '↓ risque'})`, 'SHAP']; }} />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={20} animationDuration={800}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.direction === 'augmente' ? 'var(--danger)' : 'var(--success)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </SpotlightCard>
              </Reveal>
            )}

            {reco && (
              <Reveal delay={0.3}>
                <motion.div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem', position: 'relative', overflow: 'hidden', boxShadow: `0 0 20px ${RISQUE_GLOW[niveau]}` }}>
                  <BorderBeam color={BEAM_COLOR[niveau]} duration={6} />
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Recommandation d'octroi</p>
                    <p style={{ margin: '0 0 1rem', fontSize: 11, color: 'var(--text-muted)' }}>Décision basée sur la probabilité de défaut et le score métier</p>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, background: reco.bg, border: `1.5px solid ${reco.border}`, borderRadius: 'var(--radius)', padding: '1rem 1.25rem' }}>
                      <ClipboardList size={22} color={reco.couleur} style={{ flexShrink: 0 }} />
                      <div><p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 900, color: reco.couleur }}>{reco.titre}</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>{reco.message}</p></div>
                    </motion.div>
                  </div>
                </motion.div>
              </Reveal>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!pred && !loading && <EmptyState />}
    </div>
  );
}