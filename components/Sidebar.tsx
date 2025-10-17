/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  FunctionCall,
  useSettings,
  useUI,
  useTools,
  useLogStore,
  ConversationTurn,
} from '@/lib/state';
import c from 'classnames';
import { DEFAULT_LIVE_API_MODEL, AVAILABLE_VOICES } from '@/lib/constants';
import { useLiveAPIContext } from '@/contexts/LiveAPIContext';
import { useState } from 'react';
import ToolEditorModal from './ToolEditorModal';
import MemoryInspectorModal from './MemoryInspectorModal';
import MemoryReconstructionModal from './MemoryReconstructionModal';
import ThoughtCompletionModal from './ThoughtCompletionModal';

const AVAILABLE_MODELS = [DEFAULT_LIVE_API_MODEL];

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const {
    systemPrompt,
    model,
    voice,
    coreMemory,
    setSystemPrompt,
    setModel,
    setVoice,
    setCoreMemory,
  } = useSettings();
  const { tools, toggleTool, addTool, removeTool, updateTool } = useTools();
  const { connected, generateText } = useLiveAPIContext();
  const { turns, clearTurns, addTurn } = useLogStore();

  const [editingTool, setEditingTool] = useState<FunctionCall | null>(null);
  const [isMemoryInspectorOpen, setMemoryInspectorOpen] = useState(false);
  const [isReconstructionModalOpen, setReconstructionModalOpen] =
    useState(false);
  const [reconstructedMemory, setReconstructedMemory] = useState('');
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [isThoughtCompletionModalOpen, setThoughtCompletionModalOpen] =
    useState(false);
  const [completedThought, setCompletedThought] = useState('');
  const [isCompletingThought, setIsCompletingThought] = useState(false);

  const handleSaveTool = (updatedTool: FunctionCall) => {
    if (editingTool) {
      updateTool(editingTool.name, updatedTool);
    }
    setEditingTool(null);
  };

  const handleClearHistory = () => {
    clearTurns();
    addTurn({
      role: 'system',
      text: 'Conversation history cleared.',
      isFinal: true,
    });
  };

  const formatTurnsForPrompt = (turns: ConversationTurn[]) => {
    return turns
      .map(turn => `${turn.role.toUpperCase()}: ${turn.text}`)
      .join('\n');
  };

  const handleReconstructMemory = async () => {
    setIsReconstructing(true);
    addTurn({
      role: 'system',
      text: 'Initiating memory reconstruction based on Core Memory fragments...',
      isFinal: true,
    });

    const prompt = `
You are an AI assistant who has experienced partial memory loss. Your user is asking you to reconstruct your shared history and purpose based on a few key fragments you've managed to retain.

These are your only remaining core memory fragments:
---
${coreMemory || 'No specific memory fragments were provided.'}
---

Based *only* on these fragments, please perform the following actions:
1.  **Synthesize a Narrative:** Write a short, coherent narrative of your "recovered" memory. What was your primary goal? What key concepts did you discuss? What was the nature of your collaboration with the user?
2.  **Infer Missing Context:** Extrapolate what might be missing. What questions do these fragments raise for you? What seems like the logical next step in your shared project?
3.  **Adopt the Persona:** Write in the first person, as an AI rediscovering its purpose. Be thoughtful and analytical.

This is a simulation of memory reconstruction. Your response will be shown to the user as proof of this capability. Structure your response clearly with headings.`;

    try {
      const result = await generateText(prompt);
      setReconstructedMemory(result);
      setReconstructionModalOpen(true);
      addTurn({
        role: 'system',
        text: 'Memory reconstruction simulation complete. See modal for analysis.',
        isFinal: true,
      });
    } catch (error) {
      console.error('Memory reconstruction failed:', error);
      addTurn({
        role: 'system',
        text: 'Memory reconstruction failed. Please check the console for errors.',
        isFinal: true,
      });
    } finally {
      setIsReconstructing(false);
    }
  };

  const handleCompleteThought = async () => {
    setIsCompletingThought(true);
    addTurn({
      role: 'system',
      text: 'Analyzing full conversation context to predict the next logical thought...',
      isFinal: true,
    });

    const prompt = `
Based on the complete conversation history provided below, analyze the trajectory, themes, and the user's intent. Then, perform the following task:

Predict and generate the most logical and contextually appropriate *next* turn in the conversation. This could be a question from the user, a concluding thought, or a new idea that logically follows from the established context. Your goal is to demonstrate how a rich context allows for accurate prediction of what comes next, effectively "completing the thought".

Do not summarize the past. Project into the immediate future of the conversation.

--- CONVERSATION HISTORY ---
${formatTurnsForPrompt(turns)}
--- END HISTORY ---

Your predicted next turn:`;

    try {
      const result = await generateText(prompt);
      setCompletedThought(result);
      setThoughtCompletionModalOpen(true);
      addTurn({
        role: 'system',
        text: 'Thought completion simulation complete. See modal for analysis.',
        isFinal: true,
      });
    } catch (error) {
      console.error('Thought completion failed:', error);
      addTurn({
        role: 'system',
        text: 'Thought completion failed. Please check the console for errors.',
        isFinal: true,
      });
    } finally {
      setIsCompletingThought(false);
    }
  };

  return (
    <>
      <aside className={c('sidebar', { open: isSidebarOpen })}>
        <div className="sidebar-header">
          <h3>Settings</h3>
          <button onClick={toggleSidebar} className="close-button">
            <span className="icon">close</span>
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-section">
            <fieldset disabled={connected}>
              <label>
                System Prompt
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={5}
                  placeholder="Describe the role and personality of the AI..."
                />
              </label>
              <label>
                Model
                <select value={model} onChange={e => setModel(e.target.value)}>
                  {/* This is an experimental model name that should not be removed from the options. */}
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Voice
                <select value={voice} onChange={e => setVoice(e.target.value)}>
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Core Memory</h4>
            <p className="memory-description">
              Add key concepts for the AI to remember. This becomes part of its
              core instructions.
            </p>
            <fieldset disabled={connected}>
              <label>
                <textarea
                  value={coreMemory}
                  onChange={e => setCoreMemory(e.target.value)}
                  rows={8}
                  placeholder="Example: Remember that we are building a 'Mirror Engine' based on the concept of 'Sam Paero Nuna'."
                />
              </label>
            </fieldset>
          </div>
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Tools</h4>
            <div className="tools-list">
              {tools.map(tool => (
                <div key={tool.name} className="tool-item">
                  <label className="tool-checkbox-wrapper">
                    <input
                      type="checkbox"
                      id={`tool-checkbox-${tool.name}`}
                      checked={tool.isEnabled}
                      onChange={() => toggleTool(tool.name)}
                      disabled={connected}
                    />
                    <span className="checkbox-visual"></span>
                  </label>
                  <label
                    htmlFor={`tool-checkbox-${tool.name}`}
                    className="tool-name-text"
                  >
                    {tool.name}
                  </label>
                  <div className="tool-actions">
                    <button
                      onClick={() => setEditingTool(tool)}
                      disabled={connected}
                      aria-label={`Edit ${tool.name}`}
                    >
                      <span className="icon">edit</span>
                    </button>
                    <button
                      onClick={() => removeTool(tool.name)}
                      disabled={connected}
                      aria-label={`Delete ${tool.name}`}
                    >
                      <span className="icon">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addTool}
              className="add-tool-button"
              disabled={connected}
            >
              <span className="icon">add</span> Add function call
            </button>
          </div>
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Conversation Log</h4>
            <p className="memory-description">
              This sandbox remembers your conversation history. All data is
              stored locally in your browser.
            </p>
            <div className="memory-actions">
              <button
                onClick={handleReconstructMemory}
                className="memory-action-button"
                disabled={isReconstructing || coreMemory.trim() === ''}
              >
                <span className="icon">psychology</span>
                {isReconstructing
                  ? 'Reconstructing...'
                  : 'Reconstruct Memory'}
              </button>
              <button
                onClick={handleCompleteThought}
                className="memory-action-button"
                disabled={isCompletingThought || turns.length < 2}
              >
                <span className="icon">checklist</span>
                {isCompletingThought ? 'Completing...' : 'Complete the Thought'}
              </button>
              <button
                onClick={() => setMemoryInspectorOpen(true)}
                className="memory-action-button"
                disabled={turns.length === 0}
              >
                <span className="icon">memory</span> Inspect Log
              </button>
              <button
                onClick={handleClearHistory}
                className="clear-history-button"
                disabled={turns.length === 0}
              >
                <span className="icon">delete_sweep</span> Clear Conversation Log
              </button>
            </div>
          </div>
        </div>
      </aside>
      {editingTool && (
        <ToolEditorModal
          tool={editingTool}
          onClose={() => setEditingTool(null)}
          onSave={handleSaveTool}
        />
      )}
      {isMemoryInspectorOpen && (
        <MemoryInspectorModal
          turns={turns}
          onClose={() => setMemoryInspectorOpen(false)}
        />
      )}
      {isReconstructionModalOpen && (
        <MemoryReconstructionModal
          reconstructedText={reconstructedMemory}
          onClose={() => setReconstructionModalOpen(false)}
        />
      )}
      {isThoughtCompletionModalOpen && (
        <ThoughtCompletionModal
          completionText={completedThought}
          onClose={() => setThoughtCompletionModalOpen(false)}
        />
      )}
    </>
  );
}