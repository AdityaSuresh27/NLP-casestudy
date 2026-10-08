import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, FileText, Settings, Search, Activity, Check, Download, Clock,
  BarChart2, GitBranch, BookOpen, MessageSquare, ChevronDown, ChevronRight, TrendingUp
} from 'lucide-react';
import './index.css';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

function TreeNode({ node }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div style={{ marginLeft: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.75rem', marginTop: '0.35rem' }}>
      <div
        onClick={() => hasChildren && setOpen(!open)}
        style={{
          cursor: hasChildren ? 'pointer' : 'default',
          padding: '0.4rem 0.6rem',
          borderRadius: '8px',
          background: node.isCurrentNode ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {hasChildren && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
          <span style={{ textTransform: 'capitalize' }}>{(node.action || 'root').replace(/_/g, ' ')}</span>
          {node.reward != null && (
            <span style={{ color: 'var(--primary-color)', marginLeft: 'auto', fontWeight: 400 }}>
              reward {Number(node.reward).toFixed(2)}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {node.idea}
        </div>
      </div>
      {open && hasChildren && node.children.map(child => <TreeNode key={child.id} node={child} />)}
    </div>
  );
}

function ScoreTrendChart({ history }) {
  const points = history.map(h => h.review?.total_score || 0);
  if (points.length < 2) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Need at least 2 iterations to show a trend.</p>;
  }
  const width = 100, height = 40, max = 10;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - (p / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '120px' }} preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke="var(--primary-color)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (p / max) * height;
        return <circle key={i} cx={x} cy={y} r="1.2" fill="var(--primary-color)" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('goal');
  const [researchGoal, setResearchGoal] = useState({ problem: '', motivation: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [idea, setIdea] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [papers, setPapers] = useState([]);
  const [history, setHistory] = useState([]);
  const [treeData, setTreeData] = useState(null);
  const [expandedAspect, setExpandedAspect] = useState(null);

  const [statusMsg, setStatusMsg] = useState('');

  const addToHistory = (entry) => {
    setHistory(prev => [...prev, { ...entry, timestamp: new Date().toLocaleTimeString() }]);
  };

  const fetchTree = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/tree`);
      if (res.data && Object.keys(res.data).length > 0) {
        setTreeData(res.data);
      }
    } catch (err) {
      console.error('Error fetching tree:', err);
    }
  };

  const startIdeation = async () => {
    setIsGenerating(true);
    setStatusMsg('');
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    try {
      setStatusMsg('Step 1/4: Submitting research goal...');
      await axios.post(`${API_BASE_URL}/add_knowledge`, {
        text: researchGoal.problem + ' ' + researchGoal.motivation,
        source: 'User Input'
      }, { timeout: 30000 });

      setStatusMsg('Step 2/4: Generating search query via Gemini API...');
      const queryRes = await axios.post(`${API_BASE_URL}/generate_query`, { idea: researchGoal.problem }, { timeout: 600000 });

      setStatusMsg('Step 3/4: Retrieving papers...');
      const retrieveRes = await axios.post(`${API_BASE_URL}/retrieve_knowledge`, { query: queryRes.data.query || "" }, { timeout: 600000 });
      setPapers(retrieveRes.data?.sections || []);

      setStatusMsg('Step 3/4: Waiting 10s for API quota to recover...');
      await sleep(10000);

      setStatusMsg('Step 4/4: Generating research idea via MCTS + AI Review (this may take ~60s)...');
      const chatRes = await axios.post(`${API_BASE_URL}/chat`, {
        content: researchGoal.problem
      }, { timeout: 600000 });

      const applyResult = (ideaText, reviewData, metricsData, feedbackData, action) => {
        setIdea(ideaText);
        setReview(reviewData);
        setMetrics(metricsData);
        setReviewFeedback(feedbackData || {});
        setActiveTab('ideation');
        setStatusMsg('');
        addToHistory({ action, idea: ideaText, review: reviewData, metrics: metricsData, feedback: feedbackData });
        fetchTree();
      };

      if (chatRes.data.idea) {
        applyResult(
          chatRes.data.idea,
          { total_score: chatRes.data.average_score || 0, aspect_scores: chatRes.data.review_scores || {} },
          chatRes.data.eval_metrics || {},
          chatRes.data.review_feedback || {},
          'Generate'
        );
      } else {
        const assistantMsgs = (chatRes.data.messages || []).filter(m => m.role === 'assistant');
        if (assistantMsgs.length > 0) {
          applyResult(
            assistantMsgs[assistantMsgs.length - 1].content,
            { total_score: chatRes.data.average_score || 0, aspect_scores: chatRes.data.review_scores || {} },
            chatRes.data.eval_metrics || {},
            chatRes.data.review_feedback || {},
            'Generate'
          );
        }
      }
    } catch (error) {
      console.error('Error during ideation:', error);
      const detail = error.response?.data?.error || error.message || 'Unknown error';
      const status = error.response?.status || 'N/A';
      alert(`Error (HTTP ${status}): ${detail}\n\nIf you see "429" or "rate limit", wait 1-2 minutes and try again.`);
      setStatusMsg('');
    } finally {
      setIsGenerating(false);
    }
  };

  const refineIdea = async (action) => {
    setIsGenerating(true);
    try {
      const stepRes = await axios.post(`${API_BASE_URL}/step`, { action });
      if (stepRes.data.idea) {
        const newReview = {
          total_score: stepRes.data.average_score || 0,
          aspect_scores: stepRes.data.review_scores || {}
        };
        const newMetrics = stepRes.data.eval_metrics || {};
        const newFeedback = stepRes.data.review_feedback || {};
        setIdea(stepRes.data.idea);
        setReview(newReview);
        setMetrics(newMetrics);
        setReviewFeedback(newFeedback);
        addToHistory({ action, idea: stepRes.data.idea, review: newReview, metrics: newMetrics, feedback: newFeedback });
        fetchTree();
      }
    } catch (error) {
      console.error('Error refining idea:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const viewHistoryEntry = (entry) => {
    setIdea(entry.idea);
    setReview(entry.review);
    setMetrics(entry.metrics);
    setReviewFeedback(entry.feedback || {});
  };

  const exportBrief = () => {
    if (!idea) return;
    const lines = [
      `# Research Brief`,
      ``,
      `**Generated:** ${new Date().toLocaleString()}`,
      ``,
      `## Idea`,
      idea,
      ``,
      `## AI Review Score`,
      `Total: ${review?.total_score ?? 'N/A'}/10`,
      ...Object.entries(review?.aspect_scores || {}).map(([k, v]) => `- ${k}: ${v}/10`),
      ``,
      `## Evaluation Metrics`,
      `- ROUGE-1 F1: ${metrics?.rouge1_f1 ?? 'N/A'}`,
      `- ROUGE-2 F1: ${metrics?.rouge2_f1 ?? 'N/A'}`,
      `- ROUGE-L F1: ${metrics?.rougeL_f1 ?? 'N/A'}`,
      `- Perplexity: ${metrics?.perplexity ?? 'N/A'}`,
      `- MLE (log-likelihood): ${metrics?.mle_log_likelihood ?? 'N/A'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_brief_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <header className="header animate-fade-in">
        <h1>IRIS Workspace</h1>
        <p>Interactive AI-assisted Research Ideation System</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center', flexWrap: 'wrap' }} className="animate-fade-in delay-1">
        <button className={`btn ${activeTab !== 'goal' ? 'btn-secondary' : ''}`} onClick={() => setActiveTab('goal')}>
          <Search size={18} /> Research Goal
        </button>
        <button className={`btn ${activeTab !== 'ideation' ? 'btn-secondary' : ''}`} onClick={() => setActiveTab('ideation')} disabled={!idea}>
          <Brain size={18} /> Ideation & Review
        </button>
        <button
          className={`btn ${activeTab !== 'tree' ? 'btn-secondary' : ''}`}
          onClick={() => { setActiveTab('tree'); fetchTree(); }}
          disabled={!idea}
        >
          <GitBranch size={18} /> MCTS Tree
        </button>
        <button className="btn btn-secondary" onClick={() => window.open('http://127.0.0.1:5000', '_blank')}>
          <Settings size={18} /> Open Legacy UI
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'goal' && (
          <motion.div
            key="goal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-panel"
            style={{ maxWidth: '800px', margin: '0 auto' }}
          >
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <FileText className="text-primary" /> Define Your Research
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Research Problem</label>
              <textarea
                className="input-field"
                placeholder="What specific problem are you trying to solve?"
                value={researchGoal.problem}
                onChange={e => setResearchGoal({ ...researchGoal, problem: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Motivation</label>
              <textarea
                className="input-field"
                placeholder="Why is this important? What is the background context?"
                value={researchGoal.motivation}
                onChange={e => setResearchGoal({ ...researchGoal, motivation: e.target.value })}
              />
            </div>

            <button
              className="btn"
              style={{ width: '100%' }}
              onClick={startIdeation}
              disabled={isGenerating || !researchGoal.problem}
            >
              {isGenerating ? <><Activity className="animate-spin" /> {statusMsg || 'Processing...'}</> : <><Brain /> Generate Hypotheses</>}
            </button>
            {statusMsg && <p style={{ marginTop: '1rem', color: 'var(--primary-color)', fontSize: '0.9rem', textAlign: 'center' }}>{statusMsg}</p>}
          </motion.div>
        )}

        {activeTab === 'ideation' && idea && (
          <motion.div
            key="ideation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <FileText /> Research Brief
                  </h2>
                  <button className="btn btn-secondary" onClick={exportBrief}>
                    <Download size={16} /> Export
                  </button>
                </div>
                <div style={{ marginTop: '1.5rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {idea}
                </div>
              </div>

              {/* Retrieved Papers Panel */}
              {papers.length > 0 && (
                <div className="glass-panel">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                    <BookOpen size={18} /> Retrieved Papers
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {papers.map((p, i) => (
                      <div key={i} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}>{p.title}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{p.content || p.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Idea History / Version Timeline */}
              {history.length > 0 && (
                <div className="glass-panel">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                    <Clock size={18} /> Idea History
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {history.map((entry, i) => (
                      <div
                        key={i}
                        onClick={() => viewHistoryEntry(entry)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)', fontSize: '0.85rem'
                        }}
                      >
                        <span>#{i + 1} &middot; {entry.action}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{entry.timestamp}</span>
                        <span style={{ color: 'var(--primary-color)' }}>{entry.review?.total_score ?? 'N/A'}/10</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Trend Chart */}
              {history.length > 1 && (
                <div className="glass-panel">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                    <TrendingUp size={18} /> Score Trend
                  </h3>
                  <ScoreTrendChart history={history} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                  <Activity /> AI Review Score
                </h3>
                {review ? (
                  <div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '1rem' }}>
                      {review.total_score || 'N/A'}/10
                    </div>
                    {review.aspect_scores && Object.entries(review.aspect_scores).map(([aspect, score]) => (
                      <div key={aspect}>
                        <div
                          onClick={() => setExpandedAspect(expandedAspect === aspect ? null : aspect)}
                          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.9rem', cursor: reviewFeedback[aspect] ? 'pointer' : 'default' }}
                        >
                          <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {reviewFeedback[aspect] && (expandedAspect === aspect ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                            {aspect.replace('_', ' ')}
                          </span>
                          <span>{score}/10</span>
                        </div>
                        {expandedAspect === aspect && reviewFeedback[aspect] && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                            {reviewFeedback[aspect]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No review available yet.</p>
                )}
              </div>

              {/* Evaluation Metrics Panel */}
              <div className="glass-panel">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
                  <BarChart2 size={18} /> Evaluation Metrics
                </h3>
                {metrics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>ROUGE-1 (F1)</span>
                      <span>{metrics.rouge1_f1 ?? 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>ROUGE-2 (F1)</span>
                      <span>{metrics.rouge2_f1 ?? 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>ROUGE-L (F1)</span>
                      <span>{metrics.rougeL_f1 ?? 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Perplexity</span>
                      <span>{metrics.perplexity ?? 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>MLE (log-likelihood)</span>
                      <span>{metrics.mle_log_likelihood ?? 'N/A'}</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No metrics available yet.</p>
                )}
              </div>

              <div className="glass-panel">
                <h3 style={{ margin: '0 0 1rem 0' }}>MCTS Refinement</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Guide the Monte Carlo Tree Search to explore different refinement paths.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => refineIdea('Improve Methodology')} disabled={isGenerating}>
                    {isGenerating ? 'Working...' : 'Improve Methodology'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => refineIdea('Enhance Novelty')} disabled={isGenerating}>
                    {isGenerating ? 'Working...' : 'Enhance Novelty'}
                  </button>
                  <button className="btn" style={{ marginTop: '0.5rem' }} onClick={() => refineIdea('Finalize')} disabled={isGenerating}>
                    <Check size={18} /> Accept Final Brief
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'tree' && (
          <motion.div
            key="tree"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-panel"
            style={{ maxWidth: '900px', margin: '0 auto' }}
          >
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <GitBranch /> MCTS Exploration Tree
            </h2>
            {treeData ? (
              <TreeNode node={treeData} />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No tree data yet. Generate an idea first.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
