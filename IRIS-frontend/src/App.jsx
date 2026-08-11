import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, FileText, Settings, Upload, Search, ChevronRight, Activity, Check, X } from 'lucide-react';
import './index.css';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('goal');
  const [researchGoal, setResearchGoal] = useState({ problem: '', motivation: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [idea, setIdea] = useState(null);
  const [review, setReview] = useState(null);

  const [statusMsg, setStatusMsg] = useState('');

  const startIdeation = async () => {
    setIsGenerating(true);
    setStatusMsg('');
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    try {
      // Step 1: Submit goal
      setStatusMsg('Step 1/4: Submitting research goal...');
      await axios.post(`${API_BASE_URL}/add_knowledge`, { 
        text: researchGoal.problem + ' ' + researchGoal.motivation,
        source: 'User Input'
      }, { timeout: 30000 });
      
      // Step 2: Generate query
      setStatusMsg('Step 2/4: Generating search query via Gemini API...');
      const queryRes = await axios.post(`${API_BASE_URL}/generate_query`, { idea: researchGoal.problem }, { timeout: 600000 });
      
      // Step 3: Retrieve knowledge (uses mock fallback if S2 is rate limited)
      setStatusMsg('Step 3/4: Retrieving papers...');
      await axios.post(`${API_BASE_URL}/retrieve_knowledge`, { query: queryRes.data.query || "" }, { timeout: 600000 });
      
      // Wait 10s to let Gemini API quota recover before the big MCTS call
      setStatusMsg('Step 3/4: Waiting 10s for API quota to recover...');
      await sleep(10000);
      
      // Step 4: Initialize MCTS tree via chat and generate first idea
      setStatusMsg('Step 4/4: Generating research idea via MCTS + AI Review (this may take ~60s)...');
      const chatRes = await axios.post(`${API_BASE_URL}/chat`, { 
        content: researchGoal.problem 
      }, { timeout: 600000 });
      
      if (chatRes.data.idea) {
        setIdea(chatRes.data.idea);
        setReview({
          total_score: chatRes.data.average_score || 0,
          aspect_scores: chatRes.data.review_scores || {}
        });
        setActiveTab('ideation');
        setStatusMsg('');
      } else {
        // Even if structured data is missing, try to show the messages
        const assistantMsgs = (chatRes.data.messages || []).filter(m => m.role === 'assistant');
        if (assistantMsgs.length > 0) {
          setIdea(assistantMsgs[assistantMsgs.length - 1].content);
          setReview({
            total_score: chatRes.data.average_score || 0,
            aspect_scores: chatRes.data.review_scores || {}
          });
          setActiveTab('ideation');
          setStatusMsg('');
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
      if (stepRes.data.success) {
        setIdea(stepRes.data.state.current_idea);
        setReview(stepRes.data.state.review);
      }
    } catch (error) {
      console.error('Error refining idea:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container">
      <header className="header animate-fade-in">
        <h1>IRIS Workspace</h1>
        <p>Interactive AI-assisted Research Ideation System</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }} className="animate-fade-in delay-1">
        <button className={`btn ${activeTab !== 'goal' ? 'btn-secondary' : ''}`} onClick={() => setActiveTab('goal')}>
          <Search size={18} /> Research Goal
        </button>
        <button className={`btn ${activeTab !== 'ideation' ? 'btn-secondary' : ''}`} onClick={() => setActiveTab('ideation')} disabled={!idea}>
          <Brain size={18} /> Ideation & Review
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
                onChange={e => setResearchGoal({...researchGoal, problem: e.target.value})}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Motivation</label>
              <textarea 
                className="input-field" 
                placeholder="Why is this important? What is the background context?"
                value={researchGoal.motivation}
                onChange={e => setResearchGoal({...researchGoal, motivation: e.target.value})}
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
            <div className="glass-panel">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <FileText /> Research Brief
              </h2>
              <div style={{ marginTop: '1.5rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {idea}
              </div>
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
                      <div key={aspect} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{aspect.replace('_', ' ')}</span>
                        <span>{score}/10</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No review available yet.</p>
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
      </AnimatePresence>
    </div>
  );
}
