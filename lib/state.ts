/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
// FIX: Add StateStorage for custom storage implementation
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { customerSupportTools } from './tools/customer-support';
import { personalAssistantTools } from './tools/personal-assistant';
import { navigationSystemTools } from './tools/navigation-system';

export type Template =
  | 'customer-support'
  | 'personal-assistant'
  | 'navigation-system';

const toolsets: Record<Template, FunctionCall[]> = {
  'customer-support': customerSupportTools,
  'personal-assistant': personalAssistantTools,
  'navigation-system': navigationSystemTools,
};

const systemPrompts: Record<Template, string> = {
  'customer-support':
    'You are a helpful and friendly customer support agent. Be conversational and concise.',
  'personal-assistant':
    'You are a helpful and friendly personal assistant. Be proactive and efficient.',
  'navigation-system':
    'You are a helpful and friendly navigation assistant. Provide clear and accurate directions.',
};
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponseScheduling,
} from '@google/genai';

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  coreMemory: string;
  model: string;
  voice: string;
  setSystemPrompt: (prompt: string) => void;
  setCoreMemory: (memory: string) => void;
  appendToCoreMemory: (memory: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
}>(set => ({
  systemPrompt: `You are a helpful and friendly AI assistant. Be conversational and concise.`,
  coreMemory: ``,
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setCoreMemory: memory => set({ coreMemory: memory }),
  appendToCoreMemory: memory =>
    set(state => ({
      coreMemory: state.coreMemory
        ? `${state.coreMemory}\n- ${memory}`
        : `- ${memory}`,
    })),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}>(set => ({
  isSidebarOpen: true,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
// FIX: Implement missing properties removeTool, updateTool and fix addTool
}>(set => ({
  tools: customerSupportTools,
  template: 'customer-support',
  setTemplate: (template: Template) => {
    set({ tools: toolsets[template], template });
    useSettings.getState().setSystemPrompt(systemPrompts[template]);
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === oldName ? updatedTool : tool
      ),
    })),
}));

// FIX: Define and export ConversationTurn and useLogStore
/**
 * Conversation Log
 */
export interface ConversationTurn {
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  timestamp: Date;
}

type LogState = {
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (
    update: Partial<Omit<ConversationTurn, 'role' | 'timestamp'>>
  ) => void;
  clearTurns: () => void;
};

// Fix: Removed incorrect StateStorage type annotation. The implementation is a PersistStorage, not a StateStorage.
// By removing the annotation, TypeScript infers the correct structural type, which is compatible with zustand's persist middleware.
const logStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    const { state, version } = JSON.parse(str);
    return {
      state: {
        ...state,
        turns: state.turns.map((turn: ConversationTurn) => ({
          ...turn,
          timestamp: new Date(turn.timestamp),
        })),
      },
      version,
    };
  },
  setItem: (name: string, newValue: { state: LogState; version: number }) => {
    const str = JSON.stringify(newValue);
    localStorage.setItem(name, str);
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export const useLogStore = create<LogState>()(
  persist(
    set => ({
      turns: [],
      addTurn: turn =>
        set(state => ({
          turns: [...state.turns, { ...turn, timestamp: new Date() }],
        })),
      updateLastTurn: update =>
        set(state => {
          if (state.turns.length === 0) {
            return state;
          }
          const newTurns = [...state.turns];
          const lastTurnIndex = newTurns.length - 1;
          newTurns[lastTurnIndex] = {
            ...newTurns[lastTurnIndex],
            ...update,
          };
          return { turns: newTurns };
        }),
      clearTurns: () => set({ turns: [] }),
    }),
    {
      name: 'conversation-log-storage',
      storage: logStorage,
    },
  ),
);